import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

// These tests prove tenant isolation at the database layer by running the REAL
// migrations against Postgres and querying as different authenticated users.
//
// They require a Postgres connection via TEST_DATABASE_URL (or DATABASE_URL).
// CI provides one; locally they are skipped if no database is configured.
const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "supabase", "migrations");
const shimPath = join(here, "supabase-shim.sql");

// Stable IDs for the two tenants under test.
const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function jwt(sub: string) {
  return JSON.stringify({ sub, role: "authenticated" });
}

const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb("RLS: students tenant isolation", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();

    // 1. Build the Supabase-compatible environment + apply the real migrations.
    await client.query(readFileSync(shimPath, "utf8"));
    const migrations = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrations) {
      await client.query(readFileSync(join(migrationsDir, file), "utf8"));
    }

    // 2. Seed two tenants. We run as the (superuser) connection role here, which
    //    owns the tables and therefore bypasses RLS for seeding.
    await client.query(
      `INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)`,
      [USER_A, "a@gym-a.test", USER_B, "b@gym-b.test"]
    );
    await client.query(
      `INSERT INTO public.organizations (id, name, slug)
       VALUES ($1, 'Gym A', 'gym-a'), ($2, 'Gym B', 'gym-b')`,
      [ORG_A, ORG_B]
    );
    await client.query(
      `INSERT INTO public.profiles (id, organization_id, role)
       VALUES ($1, $2, 'owner'), ($3, $4, 'owner')`,
      [USER_A, ORG_A, USER_B, ORG_B]
    );
    await client.query(
      `INSERT INTO public.students (organization_id, name, join_date) VALUES
         ($1, 'Alice (A)', CURRENT_DATE),
         ($1, 'Aaron (A)', CURRENT_DATE),
         ($2, 'Bob (B)',   CURRENT_DATE)`,
      [ORG_A, ORG_B]
    );
  });

  afterAll(async () => {
    await client?.end();
  });

  // Runs a query inside a transaction impersonating the given user via the
  // `authenticated` role + JWT claims, then rolls back so state is untouched.
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

  it("lets a user read only their own organization's students", async () => {
    const rowsA = await asUser<{ name: string; organization_id: string }>(
      USER_A,
      "SELECT name, organization_id FROM public.students ORDER BY name"
    );
    expect(rowsA.map((r) => r.name)).toEqual(["Aaron (A)", "Alice (A)"]);
    expect(rowsA.every((r) => r.organization_id === ORG_A)).toBe(true);

    const rowsB = await asUser<{ name: string }>(
      USER_B,
      "SELECT name FROM public.students ORDER BY name"
    );
    expect(rowsB.map((r) => r.name)).toEqual(["Bob (B)"]);
  });

  it("blocks a user from reading another organization's students directly", async () => {
    const rows = await asUser(
      USER_A,
      "SELECT id FROM public.students WHERE organization_id = $1",
      [ORG_B]
    );
    expect(rows).toHaveLength(0);
  });

  it("blocks a user from writing students into another organization", async () => {
    await expect(
      asUser(
        USER_A,
        `INSERT INTO public.students (organization_id, name, join_date)
         VALUES ($1, 'Mallory', CURRENT_DATE)`,
        [ORG_B]
      )
    ).rejects.toThrow(/row-level security/i);
  });
});
