import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatPeriod,
  formatPrice,
  isBillingPeriod,
  isFreePrice,
  isTrialPeriod,
  normalizePeriod,
  parseMoney,
  toAmount,
} from "@/lib/money";

describe("toAmount", () => {
  it("passes through finite numbers", () => {
    expect(toAmount(99)).toBe(99);
    expect(toAmount(0)).toBe(0);
    expect(toAmount(12.5)).toBe(12.5);
  });

  it("parses numeric strings (supabase returns numerics as strings)", () => {
    expect(toAmount("99.00")).toBe(99);
    expect(toAmount("0.00")).toBe(0);
    expect(toAmount("150.5")).toBe(150.5);
  });

  it("strips currency symbols and thousands separators", () => {
    expect(toAmount("$99.00")).toBe(99);
    expect(toAmount("R$ 1200")).toBe(1200);
  });

  it("returns 0 for null/undefined/garbage", () => {
    expect(toAmount(null)).toBe(0);
    expect(toAmount(undefined)).toBe(0);
    expect(toAmount("abc")).toBe(0);
    expect(toAmount(NaN)).toBe(0);
  });
});

describe("parseMoney", () => {
  it("parses valid non-negative input to a number", () => {
    expect(parseMoney("99.00")).toBe(99);
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("150")).toBe(150);
    expect(parseMoney(42)).toBe(42);
  });

  it("rounds to two decimal places", () => {
    expect(parseMoney("99.999")).toBe(100);
    expect(parseMoney("10.005")).toBe(10.01);
  });

  it("returns null for empty / invalid / negative input", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("   ")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney(-1)).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats USD by default", () => {
    expect(formatMoney(99)).toBe("$99.00");
    expect(formatMoney("99.00")).toBe("$99.00");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("honours an explicit currency", () => {
    expect(formatMoney(1200, "BRL")).toBe("R$1,200.00");
    expect(formatMoney(50, "EUR")).toBe("€50.00");
  });

  it("falls back gracefully for an invalid currency code", () => {
    // A non-3-letter code makes Intl throw; we render "<code> 0.00" instead.
    expect(formatMoney(10, "US")).toBe("US 10.00");
  });
});

describe("formatPrice", () => {
  it("renders Free for zero-price plans", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice("0.00")).toBe("Free");
  });

  it("formats paid plans", () => {
    expect(formatPrice(99)).toBe("$99.00");
    expect(formatPrice("150.00", "BRL")).toBe("R$150.00");
  });
});

describe("isFreePrice", () => {
  it("detects zero across string and number forms", () => {
    expect(isFreePrice(0)).toBe(true);
    expect(isFreePrice("0")).toBe(true);
    expect(isFreePrice("0.00")).toBe(true);
    expect(isFreePrice(null)).toBe(true);
    expect(isFreePrice(99)).toBe(false);
    expect(isFreePrice("0.01")).toBe(false);
  });
});

describe("billing period helpers", () => {
  it("recognises valid enum values", () => {
    expect(isBillingPeriod("monthly")).toBe(true);
    expect(isBillingPeriod("annual")).toBe(true);
    expect(isBillingPeriod("Monthly")).toBe(false);
    expect(isBillingPeriod("yearly")).toBe(false);
    expect(isBillingPeriod(null)).toBe(false);
  });

  it("normalizes legacy capitalized values onto the enum", () => {
    expect(normalizePeriod("Monthly")).toBe("monthly");
    expect(normalizePeriod("  WEEKLY ")).toBe("weekly");
    expect(normalizePeriod("Biannual")).toBe("biannual");
  });

  it("falls back to monthly for unknown / empty values", () => {
    expect(normalizePeriod("")).toBe("monthly");
    expect(normalizePeriod(null)).toBe("monthly");
    expect(normalizePeriod("fortnightly")).toBe("monthly");
  });

  it("formats period labels", () => {
    expect(formatPeriod("monthly")).toBe("Monthly");
    expect(formatPeriod("Annual")).toBe("Annual");
    expect(formatPeriod(null)).toBe("Monthly");
  });

  it("treats only free-cadence daily/weekly periods as trials", () => {
    expect(isTrialPeriod("daily")).toBe(true);
    expect(isTrialPeriod("Weekly")).toBe(true);
    expect(isTrialPeriod("monthly")).toBe(false);
    expect(isTrialPeriod("annual")).toBe(false);
  });
});
