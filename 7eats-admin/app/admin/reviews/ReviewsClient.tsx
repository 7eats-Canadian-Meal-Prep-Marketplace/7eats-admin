"use client";
import { Eye, EyeOff, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  isVisible: boolean;
  createdAt: Date | null;
  cookId: string;
  clientId: string;
  cookDisplayName: string | null;
  clientEmail: string | null;
};

const VIS_FILTERS = ["all", "visible", "hidden"] as const;
type VisFilter = (typeof VIS_FILTERS)[number];

export function ReviewsClient({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [visFilter, setVisFilter] = useState<VisFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = reviews;
    if (visFilter === "visible") list = list.filter((r) => r.isVisible);
    if (visFilter === "hidden") list = list.filter((r) => !r.isVisible);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.cookDisplayName?.toLowerCase().includes(q) ||
          r.clientEmail?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [reviews, visFilter, search]);

  async function toggleVisibility(id: string, current: boolean) {
    setLoading(id);
    const res = await fetch(`/api/admin/reviews/${id}/visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !current }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error("Failed to update visibility");
      return;
    }
    toast.success(current ? "Review hidden." : "Review shown.");
    router.refresh();
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="filters-bar">
          <div className="search-input-wrap">
            <Search size={16} className="search-input-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search cook or client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search reviews"
            />
          </div>
          <div className="filter-tabs">
            {VIS_FILTERS.map((v) => (
              <button
                key={v}
                type="button"
                className={`filter-tab ${visFilter === v ? "is-active" : ""}`}
                onClick={() => setVisFilter(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 13, color: "var(--grey-700)" }}>
          {filtered.length} reviews
        </span>
      </div>
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No reviews found</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Cook</th>
                <th>Client</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Visible</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>
                    {r.cookDisplayName ?? "—"}
                  </td>
                  <td className="table-cell-muted">{r.clientEmail ?? "—"}</td>
                  <td>
                    <span style={{ fontSize: 15 }}>
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>
                  </td>
                  <td
                    className="table-cell-muted truncate"
                    style={{ maxWidth: 200 }}
                  >
                    {r.comment
                      ? r.comment.length > 60
                        ? `${r.comment.slice(0, 60)}…`
                        : r.comment
                      : "—"}
                  </td>
                  <td>
                    <span
                      className={`badge ${r.isVisible ? "badge-active" : "badge-rejected"}`}
                    >
                      {r.isVisible ? "Visible" : "Hidden"}
                    </span>
                  </td>
                  <td className="table-cell-muted">
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleDateString("en-CA")
                      : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`btn btn-xs ${r.isVisible ? "btn-ghost" : "btn-secondary"}`}
                      disabled={loading === r.id}
                      onClick={() => toggleVisibility(r.id, r.isVisible)}
                      aria-label={r.isVisible ? "Hide review" : "Show review"}
                    >
                      {r.isVisible ? (
                        <>
                          <EyeOff size={12} /> Hide
                        </>
                      ) : (
                        <>
                          <Eye size={12} /> Show
                        </>
                      )}
                    </button>
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
