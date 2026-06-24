export type DiscountStatus = "active" | "scheduled" | "expired" | "inactive";

export function discountStatus(
  d: { isActive: boolean; startsAt: Date | null; endsAt: Date | null },
  now: Date,
): DiscountStatus {
  if (!d.isActive) return "inactive";
  if (d.startsAt && d.startsAt > now) return "scheduled";
  if (d.endsAt && d.endsAt <= now) return "expired";
  return "active";
}
