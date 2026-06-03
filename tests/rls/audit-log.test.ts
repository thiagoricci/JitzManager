import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

// Proves the audit log (issue #4) at the database layer: the students trigger
// records changes (incl. belt/rank promotions) with the acting user, and RLS
// scopes reads to org admins only. Skipped without TEST_DATABASE_URL.
const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "supabase", "migrations");
const shimPath = join(here, "supabase-shim.sql");

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const OWNER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // owner of org A
const STAFF_A = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // staff of org A (non-admin)
const OWNER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // owner of org B

function jwt(sub: string) {
  return JSON.stringify({ sub, role: "authenticated" });
}

const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb("RLS: audit log", () => {
  let client: Client;
  let studentA: number;

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
      `INSERT INTO auth.users (id, email) VALUES ($1,$2),($3,$4),($5,$6)`,
      [OWNER_A, "owner@gym-a.test", STAFF_A, "staff@gym-a.test", OWNER_B, "owner@gym-b.test"]
    );
    await client.query(
      `INSERT INTO public.organizations (id, name, slug)
       VALUES ($1, 'Gym A', 'gym-a'), ($2, 'Gym B', 'gym-b')`,
      [ORG_A, ORG_B]
    );
    await client.query(
      `INSERT INTO public.profiles (id, organization_id, role) VALUES
         ($1, $2, 'owner'), ($3, $2, 'staff'), ($4, $5, 'owner')`,
      [OWNER_A, ORG_A, STAFF_A, OWNER_B, ORG_B]
    );
    const { rows } = await client.query(
      `INSERT INTO public.students (organization_id, name, belt, stripes, join_date)
       VALUES ($1, 'Alice', 'white', 0, CURRENT_DATE) RETURNING id`,
      [ORG_A]
    );
    studentA = rows[0].id;
  });

  afterAll(async () => {
    await client?.end();
  });

  // Runs SQL impersonating a user (authenticated role + JWT claims) in a tx that
  // is rolled back, so audit rows written during the test do not leak between tests.
  async function asUser<T>(userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
    return asUserSteps<T>(userId, [{ sql, params }]);
  }

  // Like asUser but runs several statements in one impersonated tx, returning the
  // last statement's rows. Needed when a later SELECT must observe rows a trigger
  // inserted in an earlier statement (a single data-modifying CTE would not).
  async function asUserSteps<T>(
    userId: string,
    steps: { sql: string; params?: unknown[] }[]
  ): Promise<T[]> {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [jwt(userId)]);
      let rows: unknown[] = [];
      for (const step of steps) {
        ({ rows } = await client.query(step.sql, step.params ?? []));
      }
      return rows as T[];
    } finally {
      await client.query("ROLLBACK");
    }
  }

  it("records a belt promotion with the acting user, visible to the org admin", async () => {
    const rows = await asUserSteps<{ action: string; summary: string; actor_email: string }>(
      OWNER_A,
      [
        { sql: `UPDATE public.students SET belt = 'blue', stripes = 1 WHERE id = $1`, params: [studentA] },
        {
          sql: `SELECT action, summary, actor_email FROM public.audit_log
                WHERE entity_id = $1::text AND action = 'student.rank_changed'`,
          params: [studentA],
        },
      ]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_email).toBe("owner@gym-a.test");
    expect(rows[0].summary).toContain("white");
    expect(rows[0].summary).toContain("blue");
  });

  it("hides another org's audit entries", async () => {
    // Owner A promotes; owner B must not see the resulting entry.
    await client.query(
      `UPDATE public.students SET stripes = stripes + 1 WHERE id = $1`,
      [studentA]
    );
    const rowsB = await asUser(
      OWNER_B,
      `SELECT id FROM public.audit_log WHERE organization_id = $1`,
      [ORG_A]
    );
    expect(rowsB).toHaveLength(0);

    // Sanity: owner A can see entries for their own org.
    const rowsA = await asUser(
      OWNER_A,
      `SELECT id FROM public.audit_log WHERE organization_id = $1`,
      [ORG_A]
    );
    expect(rowsA.length).toBeGreaterThan(0);
  });

  it("denies a non-admin (staff) member from reading the audit log", async () => {
    const rows = await asUser(
      STAFF_A,
      `SELECT id FROM public.audit_log WHERE organization_id = $1`,
      [ORG_A]
    );
    expect(rows).toHaveLength(0);
  });

  it("does not let an authenticated user write or tamper with the audit log", async () => {
    await expect(
      asUser(
        OWNER_A,
        `INSERT INTO public.audit_log (organization_id, action, entity_type)
         VALUES ($1, 'forged', 'student')`,
        [ORG_A]
      )
    ).rejects.toThrow(/row-level security/i);
  });
});
