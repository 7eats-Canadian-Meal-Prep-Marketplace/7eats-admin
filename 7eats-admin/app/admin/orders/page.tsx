export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookProfiles } from "@/db/schema/cooks";
import { orders } from "@/db/schema/orders";
import { OrdersClient } from "./OrdersClient";

export const metadata = { title: "Order Management" };

export default async function OrdersPage() {
  const result = await db
    .select({
      id: orders.id,
      totalPrice: orders.totalPrice,
      quantity: orders.quantity,
      status: orders.status,
      pickupAt: orders.pickupAt,
      createdAt: orders.createdAt,
      clientId: orders.clientId,
      cookId: orders.cookId,
      cookDisplayName: cookProfiles.displayName,
      clientEmail: authUser.email,
    })
    .from(orders)
    .leftJoin(cookProfiles, eq(cookProfiles.id, orders.cookId))
    .leftJoin(authUser, eq(authUser.id, orders.clientId))
    .orderBy(desc(orders.createdAt))
    .limit(200);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Order Management</h1>
          <p className="page-subtitle">View and manage all platform orders</p>
        </div>
      </div>
      <OrdersClient orders={result} />
    </div>
  );
}
