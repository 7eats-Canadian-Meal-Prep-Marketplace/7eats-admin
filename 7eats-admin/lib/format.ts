// Centralized date/time formatting.
//
// 7eats operates in Canada, so we pin a single timezone for every formatted
// date. This keeps server-rendered (SSR) output identical to what the browser
// produces during hydration — without a fixed timezone, the server formats in
// its host timezone (UTC) while the browser formats in the user's local
// timezone, and the mismatched text triggers a React hydration error (#418).
//
// Currency formatting (Intl.NumberFormat with a hardcoded currency) is already
// timezone-independent and stays where it is used.

export const APP_TIME_ZONE = "America/Toronto";

type DateInput = Date | string | number;

// "2026-06-25"
export function formatDate(value: DateInput): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

// "2026-06-25, 15:04"
export function formatDateTime(value: DateInput): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// "Jun 25" — compact label for chart axes
export function formatMonthDay(value: DateInput): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
