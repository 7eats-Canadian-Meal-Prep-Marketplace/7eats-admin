import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import { orders } from "@/db/schema/orders";
import { getAdminSession } from "@/lib/session";
import { DiscountsClient } from "./DiscountsClient";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await getAdminSession();

  const rows = await db
    .select({
      id: platformDiscounts.id,
      name: platformDiscounts.name,
      description: platformDiscounts.description,
      discountType: platformDiscounts.discountType,
      value: platformDiscounts.value,
      maxDiscountAmount: platformDiscounts.maxDiscountAmount,
      minOrderSubtotal: platformDiscounts.minOrderSubtotal,
      perUserLimit: platformDiscounts.perUserLimit,
      startsAt: platformDiscounts.startsAt,
      endsAt: platformDiscounts.endsAt,
      isActive: platformDiscounts.isActive,
      redemptions: sql<number>`(
        SELECT count(*) FROM ${orders}
        WHERE ${orders.platformDiscountId} = ${platformDiscounts.id}
          AND ${orders.status} <> 'cancelled'
      )`,
    })
    .from(platformDiscounts)
    .orderBy(desc(platformDiscounts.createdAt));

  return <DiscountsClient initialDiscounts={rows} />;
}
