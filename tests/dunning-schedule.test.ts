import { describe, expect, it } from "vitest";
import {
  computeAttemptDates,
  isDue,
  toDateString,
} from "../supabase/functions/_shared/dunning-schedule";

describe("computeAttemptDates", () => {
  it("plans one attempt per offset, anchored at the failure date", () => {
    const attempts = computeAttemptDates("2026-06-01", [1, 3, 5, 7]);
    expect(attempts).toEqual([
      { attemptNumber: 1, scheduledFor: "2026-06-02", isFinal: false },
      { attemptNumber: 2, scheduledFor: "2026-06-04", isFinal: false },
      { attemptNumber: 3, scheduledFor: "2026-06-06", isFinal: false },
      { attemptNumber: 4, scheduledFor: "2026-06-08", isFinal: true },
    ]);
  });

  it("marks only the last attempt as final", () => {
    const attempts = computeAttemptDates("2026-06-01", [2]);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].isFinal).toBe(true);
  });

  it("de-duplicates, sorts, and drops non-positive offsets", () => {
    const attempts = computeAttemptDates("2026-06-01", [5, 1, 1, 0, -3, 3]);
    expect(attempts.map((a) => a.scheduledFor)).toEqual([
      "2026-06-02",
      "2026-06-04",
      "2026-06-06",
    ]);
  });

  it("rolls across month boundaries correctly", () => {
    const attempts = computeAttemptDates("2026-06-28", [1, 3]);
    expect(attempts.map((a) => a.scheduledFor)).toEqual(["2026-06-29", "2026-07-01"]);
  });

  it("returns no attempts when there are no valid offsets", () => {
    expect(computeAttemptDates("2026-06-01", [])).toEqual([]);
    expect(computeAttemptDates("2026-06-01", [0, -1])).toEqual([]);
  });

  it("accepts a full ISO timestamp and anchors on its calendar date", () => {
    const attempts = computeAttemptDates("2026-06-01T23:30:00Z", [1]);
    expect(attempts[0].scheduledFor).toBe("2026-06-02");
  });
});

describe("isDue", () => {
  it("is due on or before today, not in the future", () => {
    expect(isDue("2026-06-05", "2026-06-05")).toBe(true);
    expect(isDue("2026-06-04", "2026-06-05")).toBe(true);
    expect(isDue("2026-06-06", "2026-06-05")).toBe(false);
  });
});

describe("toDateString", () => {
  it("truncates a timestamp to its UTC calendar date", () => {
    expect(toDateString("2026-06-05T14:00:00Z")).toBe("2026-06-05");
    expect(toDateString(new Date("2026-06-05T00:00:00Z"))).toBe("2026-06-05");
  });
});
