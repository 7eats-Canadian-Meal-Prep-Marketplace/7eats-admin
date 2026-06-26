"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";

type Order = {
  id: string;
  totalPrice: string;
  quantity: number | null;
  status: string;
  pickupAt: Date | null;
  createdAt: Date | null;
  clientId: string;
  cookId: string;
  cookDisplayName: string | null;
  clientEmail: string | null;
};

const STATUS_FILTERS = [
  "all",
  "pending",
  "confirmed",
  "ready",
  "fulfilled",
  "cancelled",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function fmtMoney(n: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(n));
}

export function OrdersClient({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== "all")
      list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.cookDisplayName?.toLowerCase().includes(q) ||
          o.clientEmail?.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [orders, search, statusFilter]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="filters-bar">
          <div className="search-input-wrap">
            <Search size={16} className="search-input-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search cook, client, or order ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search orders"
            />
          </div>
          <div className="filter-tabs">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                className={`filter-tab ${statusFilter === s ? "is-active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 13, color: "var(--grey-700)", flexShrink: 0 }}>
          {filtered.length} orders
        </span>
      </div>
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No orders found</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Cook</th>
                <th>Client</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
                <th>Pickup</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  className="is-clickable"
                  onClick={() => router.push(`/admin/orders/${o.id}`)}
                >
                  <td>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontWeight: 600,
                        color: "var(--ink)",
                        textDecoration: "none",
                      }}
                    >
                      #{o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{o.cookDisplayName ?? "—"}</td>
                  <td className="table-cell-muted">{o.clientEmail ?? "—"}</td>
                  <td className="table-cell-muted">{o.quantity ?? "—"}</td>
                  <td style={{ fontWeight: 500 }}>{fmtMoney(o.totalPrice)}</td>
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
  );
}
