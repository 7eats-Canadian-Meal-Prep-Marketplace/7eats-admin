export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookProfiles } from "@/db/schema/cooks";
import { listings } from "@/db/schema/listings";
import { orderDishes, orders, reviews } from "@/db/schema/orders";
import { orderPayments } from "@/db/schema/payments";

export const metadata = { title: "Order Detail" };

function fmtMoney(n: string | null | undefined) {
  if (!n) return "$0.00";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(n));
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) notFound();

  const [cook] = await db
    .select()
    .from(cookProfiles)
    .where(eq(cookProfiles.id, order.cookId))
    .limit(1);
  const [client] = await db
    .select()
    .from(authUser)
    .where(eq(authUser.id, order.clientId))
    .limit(1);
  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, order.listingId))
    .limit(1);
  const [payment] = await db
    .select()
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId))
    .limit(1);
  const dishes = await db
    .select()
    .from(orderDishes)
    .where(eq(orderDishes.orderId, orderId));
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.orderId, orderId))
    .limit(1);

  return (
    <div>
      <Link href="/admin/orders" className="back-link">
        <ArrowLeft size={14} />
        Back to Orders
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Order #{order.id.slice(0, 8)}</h1>
          <p className="page-subtitle">
            {order.createdAt
              ? new Date(order.createdAt).toLocaleString("en-CA")
              : "—"}
          </p>
        </div>
        <span
          className={`badge badge-${order.status}`}
          style={{ fontSize: 13, padding: "5px 14px" }}
        >
          {order.status}
        </span>
      </div>

      <div className="section-gap">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Order Details</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-field">
                <span className="detail-field-label">Cook</span>
                <span className="detail-field-value">
                  {cook?.displayName ?? "—"}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Client</span>
                <span className="detail-field-value">
                  {client?.email ?? "—"}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Listing</span>
                <span className="detail-field-value">
                  {listing?.title ?? "—"}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Quantity</span>
                <span className="detail-field-value">{order.quantity}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Unit Price</span>
                <span className="detail-field-value">
                  {fmtMoney(order.unitPrice)}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Discount</span>
                <span className="detail-field-value">
                  {order.discountAmount
                    ? fmtMoney(order.discountAmount)
                    : "None"}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Total Price</span>
                <span
                  className="detail-field-value"
                  style={{ fontWeight: 700 }}
                >
                  {fmtMoney(order.totalPrice)}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Pickup At</span>
                <span className="detail-field-value">
                  {order.pickupAt
                    ? new Date(order.pickupAt).toLocaleString("en-CA")
                    : "—"}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Fulfilled At</span>
                <span className="detail-field-value">
                  {order.fulfilledAt
                    ? new Date(order.fulfilledAt).toLocaleString("en-CA")
                    : "—"}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field-label">Notes</span>
                <span
                  className={`detail-field-value ${!order.notes ? "is-empty" : ""}`}
                >
                  {order.notes ?? "None"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {dishes.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Order Dishes (snapshot)</span>
            </div>
            <div
              className="table-wrap"
              style={{ borderRadius: 0, border: "none" }}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>Dish Name</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {dishes.map((d) => (
                    <tr key={d.id}>
                      <td>{d.dishName}</td>
                      <td className="table-cell-muted">{d.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {payment && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Payment</span>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-field-label">Status</span>
                  <span className="detail-field-value">
                    <span className={`badge badge-${payment.status}`}>
                      {payment.status}
                    </span>
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">Total Amount</span>
                  <span className="detail-field-value">
                    {fmtMoney(payment.totalAmount)}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">Platform Fee %</span>
                  <span className="detail-field-value">
                    {payment.platformFeePct}%
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">
                    Platform Fee Amount
                  </span>
                  <span className="detail-field-value">
                    {fmtMoney(payment.platformFeeAmount)}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">Cook Payout</span>
                  <span className="detail-field-value">
                    {fmtMoney(payment.cookPayoutAmount)}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">Stripe PI</span>
                  <span className="detail-field-value truncate">
                    {payment.stripePaymentIntentId ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {review && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Review</span>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-field-label">Rating</span>
                  <span className="detail-field-value">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">Visible</span>
                  <span className="detail-field-value">
                    {review.isVisible ? "Yes" : "Hidden"}
                  </span>
                </div>
                <div className="detail-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="detail-field-label">Comment</span>
                  <span className="detail-field-value">
                    {review.comment ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
