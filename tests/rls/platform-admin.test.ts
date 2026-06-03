import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

// Proves the role-based platform-admin mechanism (issue #3) at the database
// layer: a `platform_admins` row grants cross-tenant reads, and a plain
// authenticated user without one is confined to their own organization.
//
// Like the other RLS tests these run the REAL migrations against Postgres and
// query as different authenticated users. Skipped without TEST_DATABASE_URL.
const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "supabase", "migrations");
const shimPath = join(here, "supabase-shim.sql");

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const MEMBER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // ordinary user, org A
const ADMIN = "dddddddd-dddd-dddd-dddd-dddddddddddd"; // platform admin

function jwt(sub: string) {
  return JSON.stringify({ sub, role: "authenticated" });
}

const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb("RLS: role-based platform admin", () => {
  let client: Client;

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

    // Seed two tenants, an ordinary member of org A, and a platform admin who
    // belongs to no organization (mirrors the real /admin operator).
    await client.query(
      `INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)`,
      [MEMBER, "member@gym-a.test", ADMIN, "admin@platform.test"]
    );
    await client.query(
      `INSERT INTO public.organizations (id, name, slug)
       VALUES ($1, 'Gym A', 'gym-a'), ($2, 'Gym B', 'gym-b')`,
      [ORG_A, ORG_B]
    );
    await client.query(
      `INSERT INTO public.profiles (id, organization_id, role)
       VALUES ($1, $2, 'owner')`,
      [MEMBER, ORG_A]
    );
    await client.query(
      `INSERT INTO public.platform_subscriptions (organization_id, status)
       VALUES ($1, 'active'), ($2, 'active')`,
      [ORG_A, ORG_B]
    );
    // Grant platform-admin to ADMIN via the role table (the new mechanism).
    await client.query(
      `INSERT INTO public.platform_admins (user_id) VALUES ($1)`,
      [ADMIN]
    );
  });

  afterAll(async () => {
    await client?.end();
  });

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

  it("denies a non-admin authenticated user platform-admin reads", async () => {
    // The member belongs only to org A, so they can never see org B or its
    // subscription — there is no email/role escape hatch granting cross-tenant
    // visibility.
    const orgs = await asUser<{ id: string }>(
      MEMBER,
      "SELECT id FROM public.organizations ORDER BY name"
    );
    expect(orgs.map((o) => o.id)).toEqual([ORG_A]);

    const subs = await asUser<{ organization_id: string }>(
      MEMBER,
      "SELECT organization_id FROM public.platform_subscriptions"
    );
    expect(subs.map((s) => s.organization_id)).toEqual([ORG_A]);

    const isAdmin = await asUser<{ is_platform_admin: boolean }>(
      MEMBER,
      "SELECT public.is_platform_admin() AS is_platform_admin"
    );
    expect(isAdmin[0].is_platform_admin).toBe(false);
  });

  it("grants a platform_admins member cross-tenant reads", async () => {
    const orgs = await asUser<{ id: string }>(
      ADMIN,
      "SELECT id FROM public.organizations ORDER BY name"
    );
    expect(orgs.map((o) => o.id)).toEqual([ORG_A, ORG_B]);

    const subs = await asUser<{ organization_id: string }>(
      ADMIN,
      "SELECT organization_id FROM public.platform_subscriptions ORDER BY organization_id"
    );
    expect(new Set(subs.map((s) => s.organization_id))).toEqual(
      new Set([ORG_A, ORG_B])
    );

    const isAdmin = await asUser<{ is_platform_admin: boolean }>(
      ADMIN,
      "SELECT public.is_platform_admin() AS is_platform_admin"
    );
    expect(isAdmin[0].is_platform_admin).toBe(true);
  });

  it("does not let an authenticated user self-grant platform admin", async () => {
    await expect(
      asUser(
        MEMBER,
        "INSERT INTO public.platform_admins (user_id) VALUES ($1)",
        [MEMBER]
      )
    ).rejects.toThrow(/row-level security/i);
  });
});
