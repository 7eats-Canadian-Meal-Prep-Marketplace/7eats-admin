export const dynamic = "force-dynamic";

import { and, count, eq, gte, sum } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { cookApplications } from "@/db/schema/applications";
import { authUser } from "@/db/schema/auth";
import { cookCertifications, cookProfiles } from "@/db/schema/cooks";
import { dishes } from "@/db/schema/dishes";
import { orders } from "@/db/schema/orders";
import { orderPayments } from "@/db/schema/payments";
import { formatDate } from "@/lib/format";
import styles from "./dashboard.module.css";

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmt(n: number | string | null | undefined) {
  if (n == null) return "0";
  return Number(n).toLocaleString("en-CA");
}

function fmtMoney(n: number | string | null | undefined) {
  if (n == null) return "$0.00";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(n));
}

export default async function DashboardPage() {
  const monthStart = startOfMonth();

  const [
    [totalUsers],
    [totalCooks],
    [pendingApps],
    [pendingCerts],
    [activeDishes],
    [ordersThisMonth],
    [revenueThisMonth],
    [platformFees],
    [fulfilledOrders],
    recentApplications,
    recentOrders,
  ] = await Promise.all([
    db.select({ count: count() }).from(authUser),
    db.select({ count: count() }).from(cookProfiles),
    db
      .select({ count: count() })
      .from(cookApplications)
      .where(eq(cookApplications.status, "pending_review")),
    db
      .select({ count: count() })
      .from(cookCertifications)
      .where(eq(cookCertifications.status, "pending_review")),
    db
      .select({ count: count() })
      .from(dishes)
      .where(eq(dishes.status, "active")),
    db
      .select({ count: count() })
      .from(orders)
      .where(gte(orders.createdAt, monthStart)),
    db
      .select({ total: sum(orders.totalPrice) })
      .from(orders)
      .where(gte(orders.createdAt, monthStart)),
    db
      .select({ total: sum(orderPayments.platformFeeAmount) })
      .from(orderPayments)
      .where(gte(orderPayments.createdAt, monthStart)),
    db
      .select({ count: count() })
      .from(orders)
      .where(
        and(eq(orders.status, "fulfilled"), gte(orders.createdAt, monthStart)),
      ),
    db
      .select({
        id: cookApplications.id,
        kitchenName: cookApplications.kitchenName,
        contactFirstName: cookApplications.contactFirstName,
        contactLastName: cookApplications.contactLastName,
        contactEmail: cookApplications.contactEmail,
        status: cookApplications.status,
        createdAt: cookApplications.createdAt,
      })
      .from(cookApplications)
      .orderBy(cookApplications.createdAt)
      .limit(10),
    db
      .select({
        id: orders.id,
        totalPrice: orders.totalPrice,
        status: orders.status,
        createdAt: orders.createdAt,
        clientId: orders.clientId,
      })
      .from(orders)
      .orderBy(orders.createdAt)
      .limit(10),
  ]);

  const stats = [
    {
      label: "Total Users",
      value: fmt(totalUsers.count),
      color: "#3b82f6",
      href: "/admin/users",
    },
    {
      label: "Active Cooks",
      value: fmt(totalCooks.count),
      color: "#8b5cf6",
      href: "/admin/cooks",
    },
    {
      label: "Pending Applications",
      value: fmt(pendingApps.count),
      color: "#f5a623",
      href: "/admin/applications",
    },
    {
      label: "Pending Certifications",
      value: fmt(pendingCerts.count),
      color: "#ef4444",
      href: "/admin/certifications",
    },
    {
      label: "Active Dishes",
      value: fmt(activeDishes.count),
      color: "#ec4899",
      href: "/admin/dishes",
    },
  ];

  const orderStats = [
    { label: "Orders This Month", value: fmt(ordersThisMonth.count) },
    { label: "Gross Volume", value: fmtMoney(revenueThisMonth.total) },
    { label: "Platform Fees", value: fmtMoney(platformFees.total) },
    { label: "Fulfilled Orders", value: fmt(fulfilledOrders.count) },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Platform overview and key metrics</p>
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.statsGrid}>
        {stats.map((s) => (
          <Link
            href={s.href}
            key={s.label}
            className={`stat-card ${styles.statLink}`}
          >
            <div className="stat-card-label">
              <div
                className="stat-card-label-icon"
                style={{ background: `${s.color}18` }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: s.color,
                  }}
                />
              </div>
              {s.label}
            </div>
            <div className="stat-card-value">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* Order stats */}
      <div className={styles.orderStatsGrid}>
        {orderStats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-card-label">{s.label}</div>
            <div className="stat-card-value" style={{ fontSize: "26px" }}>
              {s.value}
            </div>
            <div className="stat-card-sub">This month</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className={styles.activityGrid}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Applications</span>
            <Link href="/admin/applications" className="btn btn-ghost btn-sm">
              View all
            </Link>
          </div>
          <div
            className="table-wrap"
            style={{ borderRadius: 0, border: "none" }}
          >
            {recentApplications.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">No applications yet</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Kitchen</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentApplications.map((app) => (
                    <tr key={app.id} className="is-clickable">
                      <td>
                        <Link
                          href={`/admin/applications/${app.id}`}
                          className={styles.tableLink}
                        >
                          {app.kitchenName}
                        </Link>
                      </td>
                      <td className="table-cell-muted">
                        {app.contactFirstName} {app.contactLastName}
                      </td>
                      <td>
                        <span className={`badge badge-${app.status}`}>
                          {app.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="table-cell-muted">
                        {app.createdAt ? formatDate(app.createdAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Orders</span>
            <Link href="/admin/orders" className="btn btn-ghost btn-sm">
              View all
            </Link>
          </div>
          <div
            className="table-wrap"
            style={{ borderRadius: 0, border: "none" }}
          >
            {recentOrders.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">No orders yet</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className={styles.tableLink}
                        >
                          #{order.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td>{fmtMoney(order.totalPrice)}</td>
                      <td>
                        <span className={`badge badge-${order.status}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="table-cell-muted">
                        {order.createdAt ? formatDate(order.createdAt) : "—"}
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
