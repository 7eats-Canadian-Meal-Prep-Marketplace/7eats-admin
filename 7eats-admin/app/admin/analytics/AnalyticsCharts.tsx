"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonthDay } from "@/lib/format";
import styles from "./analytics.module.css";

const CHART_COLORS = [
  "#d64045",
  "#27ae60",
  "#3b82f6",
  "#f5a623",
  "#8b5cf6",
  "#e67e22",
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

type Props = {
  ordersByDay: { day: string; order_count: string; revenue: string }[];
  revenueByWeek: {
    week_start: string;
    gross_volume: string;
    platform_fees: string;
  }[];
  orderStatusBreakdown: { status: string; count: string }[];
  topCooks: {
    display_name: string;
    order_count: string;
    total_revenue: string;
  }[];
  payoutTotals: { status: string; count: string; total: string }[];
};

export function AnalyticsCharts({
  ordersByDay,
  revenueByWeek,
  orderStatusBreakdown,
  topCooks,
  payoutTotals,
}: Props) {
  const ordersData = ordersByDay.map((d) => ({
    day: formatMonthDay(d.day),
    Orders: Number(d.order_count),
    Revenue: Number(d.revenue),
  }));

  const revenueData = revenueByWeek.map((d) => ({
    week: formatMonthDay(d.week_start),
    "Gross Volume": Number(d.gross_volume),
    "Platform Fees": Number(d.platform_fees),
  }));

  const statusData = orderStatusBreakdown.map((d) => ({
    name: d.status,
    value: Number(d.count),
  }));

  const topCooksData = topCooks.map((c) => ({
    name: c.display_name ?? "Unknown",
    Orders: Number(c.order_count),
    Revenue: Number(c.total_revenue),
  }));

  return (
    <div className={styles.grid}>
      {/* Orders by day */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Orders — Last 30 Days</span>
        </div>
        <div className="card-body">
          {ordersData.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <p className="empty-state-desc">
                No order data for the last 30 days
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={ordersData}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grey-200)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "var(--grey-700)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--grey-700)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--ink-2)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  cursor={{ fill: "var(--grey-100)" }}
                />
                <Bar dataKey="Orders" fill="var(--red)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Revenue by week */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Revenue — Last 12 Weeks</span>
        </div>
        <div className="card-body">
          {revenueData.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <p className="empty-state-desc">No revenue data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={revenueData}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grey-200)" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "var(--grey-700)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--grey-700)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--ink-2)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  formatter={(v) => fmtMoney(Number(v ?? 0))}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="Gross Volume"
                  stroke="var(--red)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Platform Fees"
                  stroke="#27ae60"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Order status donut */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Order Status Breakdown</span>
        </div>
        <div
          className="card-body"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {statusData.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <p className="empty-state-desc">No order data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--ink-2)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top cooks */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Top 10 Cooks by Order Volume</span>
        </div>
        <div className="card-body">
          {topCooksData.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <p className="empty-state-desc">No cook data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                layout="vertical"
                data={topCooksData}
                margin={{ top: 4, right: 4, bottom: 0, left: 80 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--grey-200)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--grey-700)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--grey-700)" }}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--ink-2)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Orders" fill="var(--red)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Payout totals */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Payout Totals by Status</span>
        </div>
        <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
          {payoutTotals.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <p className="empty-state-desc">No payouts yet</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {payoutTotals.map((p) => (
                  <tr key={p.status}>
                    <td>
                      <span className={`badge badge-${p.status}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>{p.count}</td>
                    <td style={{ fontWeight: 500 }}>
                      {fmtMoney(Number(p.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
