import { BillingPeriod } from "@/lib/money";

// Shape of a row in the `membership_plans` table. The Supabase client is
// untyped, so this is the single source of truth for plan objects in the UI.
// Note: `price` / `setup_fee` are `numeric(10,2)` columns and supabase-js
// returns Postgres numerics as strings, so read them through the helpers in
// `@/lib/money` (`toAmount`, `formatMoney`) rather than doing raw arithmetic.
export interface MembershipPlan {
  id: number;
  organization_id: string;
  name: string;
  description: string | null;
  price: string;
  period: BillingPeriod;
  currency: string;
  setup_fee: string;
  billing_day_of_month: number | null;
  features: string[] | null;
  status: string;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  signup_link_url?: string | null;
  signup_link_id?: string | null;
}

// A plan enriched with the member counts computed on the Memberships page.
export interface MembershipPlanWithCounts extends MembershipPlan {
  activeMembers: number;
  totalMembers: number;
}
