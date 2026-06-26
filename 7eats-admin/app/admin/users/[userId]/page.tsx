export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookProfiles } from "@/db/schema/cooks";
import { orders } from "@/db/schema/orders";
import { formatDate, formatDateTime } from "@/lib/format";
import { UserActions } from "./UserActions";

export const metadata = { title: "User Detail" };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const [user] = await db
    .select()
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  if (!user) notFound();

  const [cookProfile] = await db
    .select()
    .from(cookProfiles)
    .where(eq(cookProfiles.userId, userId))
    .limit(1);

  const userOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.clientId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  return (
    <div>
      <Link href="/admin/users" className="back-link">
        <ArrowLeft size={14} />
        Back to Users
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{user.name ?? user.email}</h1>
          <p className="page-subtitle">{user.email}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className={`badge badge-${user.status}`}
            style={{ fontSize: 13, padding: "5px 14px" }}
          >
            {user.status}
          </span>
          <UserActions user={user} />
        </div>
      </div>

      <div className="section-gap">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Profile</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              {[
                { label: "Name", value: user.name },
                { label: "Email", value: user.email },
                { label: "Role", value: user.role },
                { label: "Status", value: user.status },
                { label: "First Name", value: user.firstName },
                { label: "Last Name", value: user.lastName },
                { label: "Phone", value: user.phone },
                {
                  label: "Phone Verified",
                  value: user.phoneVerified ? "Yes" : "No",
                },
                {
                  label: "Joined",
                  value: formatDateTime(user.createdAt),
                },
              ].map((f) => (
                <div key={f.label} className="detail-field">
                  <span className="detail-field-label">{f.label}</span>
                  <span
                    className={`detail-field-value ${!f.value ? "is-empty" : ""}`}
                  >
                    {f.value ?? "Not set"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {cookProfile && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Cook Profile</span>
              <Link
                href={`/admin/cooks/${cookProfile.id}`}
                className="btn btn-ghost btn-sm"
              >
                View Cook Detail
              </Link>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-field-label">Display Name</span>
                  <span className="detail-field-value">
                    {cookProfile.displayName}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">Setup Complete</span>
                  <span className="detail-field-value">
                    {cookProfile.setupComplete
                      ? "Yes"
                      : `Step ${cookProfile.currentSetupStep}/4`}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">Platform Fee</span>
                  <span className="detail-field-value">
                    {cookProfile.platformFeePct ?? "7.5"}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title">Order History (last 20)</span>
          </div>
          <div
            className="table-wrap"
            style={{ borderRadius: 0, border: "none" }}
          >
            {userOrders.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">No orders</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Pickup</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {userOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          style={{
                            fontWeight: 500,
                            color: "var(--ink)",
                            textDecoration: "none",
                          }}
                        >
                          #{o.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td>
                        {new Intl.NumberFormat("en-CA", {
                          style: "currency",
                          currency: "CAD",
                        }).format(Number(o.totalPrice))}
                      </td>
                      <td>
                        <span className={`badge badge-${o.status}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="table-cell-muted">
                        {o.pickupAt ? formatDate(o.pickupAt) : "—"}
                      </td>
                      <td className="table-cell-muted">
                        {o.createdAt ? formatDate(o.createdAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
