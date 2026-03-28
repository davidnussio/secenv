import { DateTime, Duration, Effect } from "effect";
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
 * Format: "YYYY-MM-DD HH:mm:ss" (compatible with SQLite text comparison).
 */
export const expiresAtFromNow = (duration: Duration.Duration): string => {
  const future = DateTime.addDuration(DateTime.unsafeNow(), duration);
  return DateTime.formatIso(future)
    .replace("T", " ")
    .replace("Z", "")
    .slice(0, 19);
};

/**
 * Convert a UTC datetime string (as stored in the DB) to a local datetime string
 * using the system timezone. The input is expected to be "YYYY-MM-DD HH:mm:ss" in UTC.
 */
export const formatLocalDateTime = (utcDate: string): string => {
  const d = new Date(`${utcDate}Z`);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}`;
};

/**
 * Format a human-readable "time remaining" or "time ago" string from an ISO datetime.
 */
export const formatTimeDistance = (isoDate: string): string => {
  const now = DateTime.unsafeNow();
  const target = DateTime.unsafeMake(`${isoDate}Z`);
  const diffMs = Math.abs(DateTime.distance(now, target));
  const past = DateTime.lessThan(target, now);

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const totalDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

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
