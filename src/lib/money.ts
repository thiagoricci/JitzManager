// Money + billing-period helpers for membership plans.
//
// The `membership_plans.price` / `setup_fee` columns are `numeric(10,2)` and
// `period` is the `billing_period` enum (see the typed-money migration). Note
// that supabase-js returns Postgres `numeric` values as *strings* at runtime,
// so every read helper here tolerates `string | number` and funnels through
// `toAmount`. The form, by contrast, works with parsed numbers.

export const BILLING_PERIODS = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "biannual",
  "annual",
] as const;

export type BillingPeriod = (typeof BILLING_PERIODS)[number];

// Human-readable label for each period (the enum stores lowercase values).
export const PERIOD_LABELS: Record<BillingPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Biannual",
  annual: "Annual",
};

// Free-trial plans are the free, short-cadence ones. Kept in one place so the
// UI and edge functions agree on what counts as a trial.
export const TRIAL_PERIODS: readonly BillingPeriod[] = ["daily", "weekly"];

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return (
    typeof value === "string" &&
    (BILLING_PERIODS as readonly string[]).includes(value)
  );
}

// Coerce any stored/legacy period string onto the enum. Handles the historical
// capitalized values ("Monthly") and trims whitespace; unknown values fall back
// to "monthly" to match the migration's backfill.
export function normalizePeriod(value: string | null | undefined): BillingPeriod {
  const lowered = (value ?? "").trim().toLowerCase();
  return isBillingPeriod(lowered) ? lowered : "monthly";
}

export function formatPeriod(value: string | null | undefined): string {
  return PERIOD_LABELS[normalizePeriod(value)];
}

export function isTrialPeriod(value: string | null | undefined): boolean {
  return TRIAL_PERIODS.includes(normalizePeriod(value));
}

// Coerce a stored money value (string or number) into a finite number of major
// units. Strips currency symbols / thousands separators; invalid input -> 0.
export function toAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Parse raw user input from the plan form. Returns null when the input is not a
// valid, non-negative amount so callers can surface a validation error.
export function parseMoney(input: string | number | null | undefined): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? input : null;
  }
  if (input == null) return null;
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  // Round to cents so 99.999 can never sneak past numeric(10,2).
  return Math.round(parsed * 100) / 100;
}

export function isFreePrice(value: string | number | null | undefined): boolean {
  return toAmount(value) === 0;
}

// Format a money value for display, e.g. formatMoney(99, "USD") -> "$99.00".
export function formatMoney(
  value: string | number | null | undefined,
  currency: string = "USD"
): string {
  const amount = toAmount(value);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain "<code> 0.00" rendering.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Convenience for plan cards: "Free" for zero-price plans, formatted otherwise.
export function formatPrice(
  value: string | number | null | undefined,
  currency: string = "USD"
): string {
  return isFreePrice(value) ? "Free" : formatMoney(value, currency);
}
