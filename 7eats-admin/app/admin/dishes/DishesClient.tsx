"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/admin/Modal";
import { formatDate } from "@/lib/format";

type Dish = {
  id: string;
  name: string;
  price: string;
  status: string;
  cuisine: string | null;
  createdAt: Date | null;
  cookId: string;
  cookDisplayName: string | null;
  userEmail: string | null;
};

const STATUS_FILTERS = ["all", "draft", "active", "archived"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function fmtMoney(n: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(n));
}

export function DishesClient({ dishes }: { dishes: Dish[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [archiveModal, setArchiveModal] = useState<Dish | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = dishes;
    if (statusFilter !== "all")
      list = list.filter((d) => d.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.cookDisplayName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [dishes, statusFilter, search]);

  async function setStatus(dish: Dish, status: "active" | "archived") {
    setLoading(dish.id);
    const res = await fetch(`/api/admin/dishes/${dish.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error(
        status === "archived"
          ? "Failed to archive dish"
          : "Failed to restore dish",
      );
      return;
    }
    toast.success(status === "archived" ? "Dish archived." : "Dish restored.");
    setArchiveModal(null);
    router.refresh();
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <div className="search-input-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="Search dish or cook…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search dishes"
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
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No dishes found</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Cook</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td className="table-cell-muted">
                      {d.cookDisplayName ?? "—"}
                    </td>
                    <td>{fmtMoney(d.price)}</td>
                    <td>
                      <span className={`badge badge-${d.status}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="table-cell-muted">
                      {d.createdAt ? formatDate(d.createdAt) : "—"}
                    </td>
                    <td>
                      {d.status === "archived" ? (
                        <button
                          type="button"
                          className="btn btn-xs btn-secondary"
                          disabled={loading === d.id}
                          onClick={() => setStatus(d, "active")}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-xs btn-danger"
                          disabled={loading === d.id}
                          onClick={() => setArchiveModal(d)}
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {archiveModal && (
        <Modal
          title="Archive Dish"
          onClose={() => setArchiveModal(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setArchiveModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-danger ${loading === archiveModal.id ? "btn-loading" : ""}`}
                onClick={() => setStatus(archiveModal, "archived")}
                disabled={loading === archiveModal.id}
              >
                {loading === archiveModal.id ? "Archiving…" : "Archive"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "var(--grey-700)" }}>
            Archive <strong>{archiveModal.name}</strong>? It will be removed
            from public listings until restored. Existing orders are unaffected.
          </p>
        </Modal>
      )}
    </>
  );
}
