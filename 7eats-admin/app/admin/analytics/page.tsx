export const dynamic = "force-dynamic";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AnalyticsCharts } from "./AnalyticsCharts";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    ordersByDay,
    revenueByWeek,
    orderStatusBreakdown,
    topCooks,
    payoutTotals,
  ] = await Promise.all([
    // Orders by day (last 30 days)
    db.execute(sql`
      SELECT
        DATE(created_at) as day,
        COUNT(*) as order_count,
        SUM(total_price) as revenue
      FROM orders
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `),
    // Revenue by week (last 12 weeks)
    db.execute(sql`
      SELECT
        DATE_TRUNC('week', o.created_at) as week_start,
        SUM(o.total_price) as gross_volume,
        SUM(op.platform_fee_amount) as platform_fees
      FROM orders o
      LEFT JOIN order_payments op ON op.order_id = o.id
      WHERE o.created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY week_start
      ORDER BY week_start ASC
    `),
    // Order status breakdown
    db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `),
    // Top 10 cooks by order volume
    db.execute(sql`
      SELECT
        cp.display_name,
        COUNT(o.id) as order_count,
        SUM(o.total_price) as total_revenue
      FROM orders o
      JOIN cook_profiles cp ON cp.id = o.cook_id
      GROUP BY cp.id, cp.display_name
      ORDER BY order_count DESC
      LIMIT 10
    `),
    // Payout totals by status
    db.execute(sql`
      SELECT status, COUNT(*) as count, SUM(amount) as total
      FROM cook_payouts
      GROUP BY status
    `),
  ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">
            Platform performance metrics and trends
          </p>
        </div>
      </div>

      <AnalyticsCharts
        ordersByDay={
          ordersByDay.rows as {
            day: string;
            order_count: string;
            revenue: string;
          }[]
        }
        revenueByWeek={
          revenueByWeek.rows as {
            week_start: string;
            gross_volume: string;
            platform_fees: string;
          }[]
        }
        orderStatusBreakdown={
          orderStatusBreakdown.rows as { status: string; count: string }[]
        }
        topCooks={
          topCooks.rows as {
            display_name: string;
            order_count: string;
            total_revenue: string;
          }[]
        }
        payoutTotals={
          payoutTotals.rows as {
            status: string;
            count: string;
            total: string;
          }[]
        }
      />
    </div>
  );
}
