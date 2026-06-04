import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

// Proves the org staff role permission matrix (issue #5) at the database layer by
// running the REAL migrations and querying as users of each role. Requires a
// Postgres connection via TEST_DATABASE_URL (or DATABASE_URL); skipped otherwise.
const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "supabase", "migrations");
const shimPath = join(here, "supabase-shim.sql");

const ORG = "33333333-3333-3333-3333-333333333333";
const OWNER = "00000000-0000-0000-0000-0000000000a1";
const ADMIN = "00000000-0000-0000-0000-0000000000a2";
const COACH = "00000000-0000-0000-0000-0000000000a3";
const FRONT = "00000000-0000-0000-0000-0000000000a4";

function jwt(sub: string) {
  return JSON.stringify({ sub, role: "authenticated" });
}

const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb("RLS: org staff roles & permissions", () => {
  let client: Client;
  let studentId: number;

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();

    await client.query(readFileSync(shimPath, "utf8"));
    const migrations = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrations) {
      await client.query(readFileSync(join(migrationsDir, file), "utf8"));
    }

    await client.query(
      `INSERT INTO auth.users (id, email) VALUES
         ($1,'owner@gym.test'), ($2,'admin@gym.test'),
         ($3,'coach@gym.test'), ($4,'front@gym.test')`,
      [OWNER, ADMIN, COACH, FRONT]
    );
    await client.query(
      `INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Gym', 'gym')`,
      [ORG]
    );
    await client.query(
      `INSERT INTO public.profiles (id, organization_id, role) VALUES
         ($1,$5,'owner'), ($2,$5,'admin'), ($3,$5,'coach'), ($4,$5,'front_desk')`,
      [OWNER, ADMIN, COACH, FRONT, ORG]
    );
    const { rows } = await client.query(
      `INSERT INTO public.students (organization_id, name, belt, stripes, join_date)
       VALUES ($1, 'Sam', 'white', 0, CURRENT_DATE) RETURNING id`,
      [ORG]
    );
    studentId = rows[0].id;
  });

  afterAll(async () => {
    await client?.end();
  });

  // Runs sql impersonating the given user, then rolls back so state is untouched.
  async function asUser<T>(
    userId: string,
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        jwt(userId),
      ]);
      const { rows } = await client.query(sql, params);
      return rows as T[];
    } finally {
      await client.query("ROLLBACK");
    }
  }

  const insertStudent = (uid: string) =>
    asUser(
      uid,
      `INSERT INTO public.students (organization_id, name, join_date)
       VALUES ($1, 'New', CURRENT_DATE) RETURNING id`,
      [ORG]
    );

  describe("student record management (owner/admin/front_desk)", () => {
    it("lets front desk and admins add students", async () => {
      expect(await insertStudent(FRONT)).toHaveLength(1);
      expect(await insertStudent(ADMIN)).toHaveLength(1);
      expect(await insertStudent(OWNER)).toHaveLength(1);
    });

    it("blocks coaches from adding students", async () => {
      await expect(insertStudent(COACH)).rejects.toThrow(/row-level security/i);
    });

    it("lets front desk delete students but not coaches", async () => {
      const front = await asUser(
        FRONT,
        `DELETE FROM public.students WHERE id = $1 RETURNING id`,
        [studentId]
      );
      expect(front).toHaveLength(1);

      const coach = await asUser(
        COACH,
        `DELETE FROM public.students WHERE id = $1 RETURNING id`,
        [studentId]
      );
      expect(coach).toHaveLength(0);
    });
  });

  describe("rank promotion is column-scoped", () => {
    it("lets coaches change belt/stripes only", async () => {
      const ok = await asUser(
        COACH,
        `UPDATE public.students SET belt = 'blue', stripes = 1 WHERE id = $1 RETURNING id`,
        [studentId]
      );
      expect(ok).toHaveLength(1);
    });

    it("blocks coaches from changing non-rank fields", async () => {
      await expect(
        asUser(
          COACH,
          `UPDATE public.students SET name = 'Renamed' WHERE id = $1`,
          [studentId]
        )
      ).rejects.toThrow(/rank/i);
    });

    it("lets front desk edit non-rank fields", async () => {
      const ok = await asUser(
        FRONT,
        `UPDATE public.students SET name = 'Renamed' WHERE id = $1 RETURNING id`,
        [studentId]
      );
      expect(ok).toHaveLength(1);
    });

    it("blocks front desk from changing rank", async () => {
      await expect(
        asUser(
          FRONT,
          `UPDATE public.students SET belt = 'purple' WHERE id = $1`,
          [studentId]
        )
      ).rejects.toThrow(/rank/i);
    });

    it("lets admins change both rank and other fields", async () => {
      const ok = await asUser(
        ADMIN,
        `UPDATE public.students SET name = 'A', belt = 'black' WHERE id = $1 RETURNING id`,
        [studentId]
      );
      expect(ok).toHaveLength(1);
    });
  });

  describe("attendance is recordable by every role", () => {
    it.each([
      ["owner", OWNER],
      ["admin", ADMIN],
      ["coach", COACH],
      ["front_desk", FRONT],
    ])("lets %s record attendance", async (_label, uid) => {
      const rows = await asUser(
        uid,
        `INSERT INTO public.attendance (organization_id, student_id)
         VALUES ($1, $2) RETURNING id`,
        [ORG, studentId]
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe("class schedule is readable and writable by every role", () => {
    it.each([
      ["owner", OWNER],
      ["admin", ADMIN],
      ["coach", COACH],
      ["front_desk", FRONT],
    ])("lets %s create a class", async (_label, uid) => {
      const rows = await asUser(
        uid,
        `INSERT INTO public.schedules (organization_id, name, day_of_week, start_time, end_time)
         VALUES ($1, 'Class', 1, '18:00', '19:00') RETURNING id`,
        [ORG]
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe("billing/settings config is owner/admin only", () => {
    it("blocks coach/front_desk from creating membership plans", async () => {
      const plan = (uid: string) =>
        asUser(
          uid,
          `INSERT INTO public.membership_plans (organization_id, name, price, period, status)
           VALUES ($1, 'P', 10, 'monthly', 'active') RETURNING id`,
          [ORG]
        );
      await expect(plan(COACH)).rejects.toThrow(/row-level security/i);
      await expect(plan(FRONT)).rejects.toThrow(/row-level security/i);
      expect(await plan(ADMIN)).toHaveLength(1);
    });

    it("hides the org row from non-admins for updates", async () => {
      // UPDATE policy USING is_org_admin(): non-admins simply match zero rows.
      const coach = await asUser(
        COACH,
        `UPDATE public.organizations SET name = 'Hacked' WHERE id = $1 RETURNING id`,
        [ORG]
      );
      expect(coach).toHaveLength(0);

      const admin = await asUser(
        ADMIN,
        `UPDATE public.organizations SET name = 'Renamed' WHERE id = $1 RETURNING id`,
        [ORG]
      );
      expect(admin).toHaveLength(1);
    });
  });
});
