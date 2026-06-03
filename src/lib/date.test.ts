import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatDate,
  getDayOfWeekInTimezone,
  getTodayInTimezone,
} from "@/lib/date";

describe("formatDate", () => {
  it("returns an empty string for null/undefined/empty input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("renders plain YYYY-MM-DD strings as the exact calendar date (no tz shift)", () => {
    // Join dates / birth dates must display exactly as stored, regardless of tz.
    expect(formatDate("2024-03-15")).toBe("March 15th, 2024");
    // Passing a far-west timezone must not roll the date back a day.
    expect(formatDate("2024-03-15", "Pacific/Kiritimati")).toBe(
      "March 15th, 2024"
    );
    expect(formatDate("2024-03-15", "Pacific/Pago_Pago")).toBe(
      "March 15th, 2024"
    );
  });

  it("honours a custom format string for plain dates", () => {
    expect(formatDate("2024-03-15", undefined, "yyyy-MM-dd")).toBe("2024-03-15");
    expect(formatDate("2024-12-25", "UTC", "MMM d")).toBe("Dec 25");
  });

  it("converts timestamps into the target timezone", () => {
    // 02:30 UTC is the previous day in Los Angeles but same day in Tokyo.
    const instant = "2024-01-01T02:30:00Z";
    expect(formatDate(instant, "America/Los_Angeles", "yyyy-MM-dd")).toBe(
      "2023-12-31"
    );
    expect(formatDate(instant, "Asia/Tokyo", "yyyy-MM-dd")).toBe("2024-01-01");
    expect(formatDate(instant, "UTC", "yyyy-MM-dd HH:mm")).toBe(
      "2024-01-01 02:30"
    );
  });

  it("accepts Date objects", () => {
    const d = new Date("2024-06-15T12:00:00Z");
    expect(formatDate(d, "UTC", "yyyy-MM-dd")).toBe("2024-06-15");
  });
});

describe("timezone-aware 'now' helpers", () => {
  beforeEach(() => {
    // Fix the clock at 02:30 UTC on 2024-01-01 (a Monday in UTC).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T02:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getTodayInTimezone reflects the local calendar date per timezone", () => {
    expect(getTodayInTimezone("UTC")).toBe("2024-01-01");
    // West of UTC it is still the previous day at this instant.
    expect(getTodayInTimezone("America/Los_Angeles")).toBe("2023-12-31");
    // East of UTC it is already the new day.
    expect(getTodayInTimezone("Asia/Tokyo")).toBe("2024-01-01");
  });

  it("getDayOfWeekInTimezone returns the 0-6 weekday per timezone", () => {
    // 2024-01-01 is a Monday (1); 2023-12-31 is a Sunday (0).
    expect(getDayOfWeekInTimezone("UTC")).toBe(1);
    expect(getDayOfWeekInTimezone("America/Los_Angeles")).toBe(0);
    expect(getDayOfWeekInTimezone("Asia/Tokyo")).toBe(1);
  });
});
