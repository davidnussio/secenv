import { Duration, Effect } from "effect";
import { InvalidDurationError } from "../errors.js";

/**
 * Parse a human-readable compact duration string into an Effect Duration.
 *
 * Supported formats:
 *   30m, 2h, 7d, 4w, 3mo, 1y
 *   Combinations: 1y6mo, 2w3d, 1d12h
 *
 * Units:
 *   m  = minutes
 *   h  = hours
 *   d  = days
 *   w  = weeks
 *   mo = months (30 days)
 *   y  = years (365 days)
 */

const UNIT_TO_DURATION: Record<string, (n: number) => Duration.Duration> = {
  m: (n) => Duration.minutes(n),
  h: (n) => Duration.hours(n),
  d: (n) => Duration.days(n),
  w: (n) => Duration.weeks(n),
  mo: (n) => Duration.days(n * 30),
  y: (n) => Duration.days(n * 365),
};

const SEGMENT_PATTERN = /^(\d+)(mo|[mhdwy])(.*)$/;

export const parseDuration = Effect.fn("parseDuration")(function* (
  input: string
) {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === "") {
    return yield* new InvalidDurationError({
      input,
      message: "Duration cannot be empty",
    });
  }

  let remaining = trimmed;
  let total = Duration.zero;
  let matched = false;

  while (remaining.length > 0) {
    const match = SEGMENT_PATTERN.exec(remaining);
    if (!(match?.[1] && match[2])) {
      return yield* new InvalidDurationError({
        input,
        message: `Invalid duration "${input}" — use formats like 30m, 2h, 7d, 4w, 3mo, 1y (combinable: 1y6mo, 2w3d)`,
      });
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];
    const toDuration = UNIT_TO_DURATION[unit];

    if (!toDuration || value < 0) {
      return yield* new InvalidDurationError({
        input,
        message: `Invalid duration "${input}" — value must be a positive integer with a valid unit (m, h, d, w, mo, y)`,
      });
    }

    total = Duration.sum(total, toDuration(value));
    matched = true;
    remaining = match[3] ?? "";
  }

  if (!matched) {
    return yield* new InvalidDurationError({
      input,
      message: `Invalid duration "${input}" — use formats like 30m, 2h, 7d, 4w, 3mo, 1y`,
    });
  }

  return total;
});

/**
 * Compute an ISO datetime string (UTC, no timezone suffix) for `now + duration`.
 */
export const expiresAtFromNow = (duration: Duration.Duration): string => {
  const ms = Duration.toMillis(duration);
  const date = new Date(Date.now() + ms);
  return date.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
};

/**
 * Format a human-readable "time remaining" or "time ago" string from an ISO datetime.
 */
export const formatTimeDistance = (isoDate: string): string => {
  const target = new Date(`${isoDate}Z`).getTime();
  const now = Date.now();
  const diff = Duration.millis(Math.abs(target - now));
  const past = target < now;

  const totalMinutes = Math.floor(Duration.toMillis(diff) / (60 * 1000));
  const totalHours = Math.floor(Duration.toMillis(diff) / (60 * 60 * 1000));
  const totalDays = Math.floor(Duration.toMillis(diff) / (24 * 60 * 60 * 1000));

  let label: string;
  if (totalDays > 0) {
    label = `${totalDays}d`;
  } else if (totalHours > 0) {
    label = `${totalHours}h`;
  } else {
    label = `${totalMinutes}m`;
  }

  return past ? `${label} ago` : `in ${label}`;
};
