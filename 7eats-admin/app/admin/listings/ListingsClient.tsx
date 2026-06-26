"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/admin/Modal";
import { formatDate } from "@/lib/format";

type Listing = {
  id: string;
  title: string;
  basePrice: string;
  minOrderQty: number;
  maxOrderQty: number | null;
  status: string;
  createdAt: Date | null;
  cookId: string;
  cookDisplayName: string | null;
  userEmail: string | null;
};

const STATUS_FILTERS = ["all", "pending_review", "active", "archived"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function fmtMoney(n: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(n));
}

export function ListingsClient({ listings }: { listings: Listing[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [rejectModal, setRejectModal] = useState<Listing | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = listings;
    if (statusFilter !== "all")
      list = list.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.cookDisplayName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [listings, statusFilter, search]);

  async function handleApprove(id: string) {
    setLoading(id);
    const res = await fetch(`/api/admin/listings/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error("Failed to approve listing");
      return;
    }
    toast.success("Listing approved.");
    router.refresh();
  }

  async function handleReject() {
    if (!rejectModal) return;
    if (!rejectNotes.trim()) {
      toast.error("Reason required");
      return;
    }
    setLoading(rejectModal.id);
    const res = await fetch(`/api/admin/listings/${rejectModal.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", reviewNotes: rejectNotes }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error("Failed to reject listing");
      return;
    }
    toast.success("Listing rejected.");
    setRejectModal(null);
    setRejectNotes("");
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
                placeholder="Search title or cook…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search listings"
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
                  {s === "all"
                    ? "All"
                    : s === "pending_review"
                      ? "Pending"
                      : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No listings found</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Cook</th>
                  <th>Price</th>
                  <th>Min/Max Qty</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>{l.title}</td>
                    <td className="table-cell-muted">
                      {l.cookDisplayName ?? "—"}
                    </td>
                    <td>{fmtMoney(l.basePrice)}</td>
                    <td className="table-cell-muted">
                      {l.minOrderQty} / {l.maxOrderQty ?? "∞"}
                    </td>
                    <td>
                      <span className={`badge badge-${l.status}`}>
                        {l.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="table-cell-muted">
                      {l.createdAt ? formatDate(l.createdAt) : "—"}
                    </td>
                    <td>
                      {l.status === "pending_review" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            disabled={loading === l.id}
                            onClick={() => handleApprove(l.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-danger"
                            disabled={loading === l.id}
                            onClick={() => setRejectModal(l)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {rejectModal && (
        <Modal
          title="Reject Listing"
          onClose={() => {
            setRejectModal(null);
            setRejectNotes("");
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setRejectModal(null);
                  setRejectNotes("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-danger ${loading === rejectModal.id ? "btn-loading" : ""}`}
                onClick={handleReject}
                disabled={loading === rejectModal.id}
              >
                {loading === rejectModal.id ? "Rejecting…" : "Reject"}
              </button>
            </>
          }
        >
          <p
            style={{ fontSize: 14, color: "var(--grey-700)", marginBottom: 16 }}
          >
            Rejecting <strong>{rejectModal.title}</strong>.
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="reject-listing-notes">
              Reason <span className="required">*</span>
            </label>
            <textarea
              id="reject-listing-notes"
              className="form-textarea"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Explain why this listing is being rejected…"
              rows={3}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
