// Pure scheduling math for automated dunning (no Deno/remote imports, so this
// can be unit-tested directly under Vitest).
//
// A failed payment is retried on a configurable set of day-offsets after the
// first failure (default 1, 3, 5, 7). computeAttemptDates turns that schedule
// into concrete calendar dates; the last attempt is the "final" one, after which
// the membership is frozen.

export interface PlannedAttempt {
  attemptNumber: number; // 1-based
  scheduledFor: string; // YYYY-MM-DD
  isFinal: boolean;
}

// Normalise a Date or ISO/date string to a YYYY-MM-DD calendar string (UTC).
export function toDateString(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

// Given the first-failure date and the retry-day offsets, return one planned
// attempt per offset. Offsets are de-duplicated, sorted ascending, and any
// non-positive values are dropped. Returns [] when there are no valid offsets.
export function computeAttemptDates(
  firstFailure: string | Date,
  retryDays: number[],
): PlannedAttempt[] {
  const offsets = Array.from(new Set(retryDays))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const base = new Date(toDateString(firstFailure) + "T00:00:00Z");

  return offsets.map((offset, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    return {
      attemptNumber: i + 1,
      scheduledFor: toDateString(d),
      isFinal: i === offsets.length - 1,
    };
  });
}

// An attempt is due when its scheduled calendar date is today or earlier.
export function isDue(scheduledFor: string | Date, today: string | Date): boolean {
  return toDateString(scheduledFor) <= toDateString(today);
}
