import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

// Proves the dunning substrate (issue #7) at the database layer: the org config
// columns get sane defaults, the guarded pg_cron migration is a clean no-op on
// plain Postgres, and the dunning_attempts ledger is admin-readable and
// append-only (only the service_role runner writes it). Skipped without a DB.
const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "supabase", "migrations");
const shimPath = join(here, "supabase-shim.sql");

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const OWNER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // admin of org A
const STAFF_A = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // coach of org A (non-admin)
const OWNER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // owner of org B

function jwt(sub: string) {
  return JSON.stringify({ sub, role: "authenticated" });
}

const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb("RLS: dunning substrate", () => {
  let client: Client;
  let attemptA: number;

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
         ($1, $2, 'owner'), ($3, $2, 'coach'), ($4, $5, 'owner')`,
      [OWNER_A, ORG_A, STAFF_A, OWNER_B, ORG_B]
    );
    const { rows: studentRows } = await client.query(
      `INSERT INTO public.students (organization_id, name, belt, stripes, join_date)
       VALUES ($1, 'Alice', 'white', 0, CURRENT_DATE) RETURNING id`,
      [ORG_A]
    );
    const { rows: paymentRows } = await client.query(
      `INSERT INTO public.payments (organization_id, student_id, amount, date, status)
       VALUES ($1, $2, 100, CURRENT_DATE, 'failed') RETURNING id`,
      [ORG_A, studentRows[0].id]
    );
    // Insert a ledger row as the DB owner (bypasses RLS, like the service_role runner).
    const { rows: attemptRows } = await client.query(
      `INSERT INTO public.dunning_attempts
         (organization_id, payment_id, student_id, attempt_number, scheduled_for, is_final)
       VALUES ($1, $2, $3, 1, CURRENT_DATE, false) RETURNING id`,
      [ORG_A, paymentRows[0].id, studentRows[0].id]
    );
    attemptA = attemptRows[0].id;
  });

  afterAll(async () => {
    await client?.end();
  });

  async function asUser<T>(userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [jwt(userId)]);
      const { rows } = await client.query(sql, params);
      return rows as T[];
    } finally {
      await client.query("ROLLBACK");
    }
  }

  it("defaults the per-org dunning config", async () => {
    const { rows } = await client.query(
      `SELECT dunning_enabled, dunning_retry_days, dunning_freeze_on_final
       FROM public.organizations WHERE id = $1`,
      [ORG_A]
    );
    expect(rows[0].dunning_enabled).toBe(true);
    expect(rows[0].dunning_retry_days).toEqual([1, 3, 5, 7]);
    expect(rows[0].dunning_freeze_on_final).toBe(true);
  });

  it("lets an org admin read their own dunning attempts", async () => {
    const rows = await asUser(OWNER_A, `SELECT id FROM public.dunning_attempts WHERE id = $1`, [
      attemptA,
    ]);
    expect(rows).toHaveLength(1);
  });

  it("hides another org's dunning attempts", async () => {
    const rows = await asUser(
      OWNER_B,
      `SELECT id FROM public.dunning_attempts WHERE organization_id = $1`,
      [ORG_A]
    );
    expect(rows).toHaveLength(0);
  });

  it("denies a non-admin (coach) member from reading the ledger", async () => {
    const rows = await asUser(
      STAFF_A,
      `SELECT id FROM public.dunning_attempts WHERE organization_id = $1`,
      [ORG_A]
    );
    expect(rows).toHaveLength(0);
  });

  it("does not let an authenticated user write to the ledger", async () => {
    await expect(
      asUser(
        OWNER_A,
        `INSERT INTO public.dunning_attempts
           (organization_id, payment_id, student_id, attempt_number, scheduled_for)
         VALUES ($1, 1, 1, 1, CURRENT_DATE)`,
        [ORG_A]
      )
    ).rejects.toThrow(/row-level security/i);
  });
});
