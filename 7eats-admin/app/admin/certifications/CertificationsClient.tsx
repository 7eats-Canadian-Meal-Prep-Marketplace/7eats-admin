"use client";
import { ExternalLink, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/admin/Modal";
import { formatDate } from "@/lib/format";

type Cert = {
  id: string;
  name: string;
  holderName: string;
  issuer: string | null;
  expiresAt: Date | null;
  fileUrl: string | null;
  status: string;
  createdAt: Date | null;
  cookId: string;
  cookDisplayName: string | null;
  userEmail: string | null;
};

const STATUS_FILTERS = [
  "all",
  "pending_review",
  "approved",
  "rejected",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function CertificationsClient({
  certifications,
}: {
  certifications: Cert[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [rejectModal, setRejectModal] = useState<Cert | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = certifications;
    if (statusFilter !== "all")
      list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.cookDisplayName?.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [certifications, statusFilter, search]);

  async function handleApprove(certId: string) {
    setLoading(certId);
    const res = await fetch(`/api/admin/certifications/${certId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error("Failed to approve");
      return;
    }
    toast.success("Certification approved.");
    router.refresh();
  }

  async function handleReject() {
    if (!rejectModal) return;
    if (!rejectNotes.trim()) {
      toast.error("Notes required");
      return;
    }
    setLoading(rejectModal.id);
    const res = await fetch(
      `/api/admin/certifications/${rejectModal.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", reviewNotes: rejectNotes }),
      },
    );
    setLoading(null);
    if (!res.ok) {
      toast.error("Failed to reject");
      return;
    }
    toast.success("Certification rejected.");
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
                placeholder="Search cook or cert name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search certifications"
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
              <p className="empty-state-title">No certifications found</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Cook</th>
                  <th>Cert Name</th>
                  <th>Holder</th>
                  <th>Issuer</th>
                  <th>Expires</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cert) => (
                  <tr key={cert.id}>
                    <td style={{ fontWeight: 500 }}>
                      {cert.cookDisplayName ?? "—"}
                    </td>
                    <td>{cert.name}</td>
                    <td className="table-cell-muted">{cert.holderName}</td>
                    <td className="table-cell-muted">{cert.issuer ?? "—"}</td>
                    <td className="table-cell-muted">
                      {cert.expiresAt ? formatDate(cert.expiresAt) : "—"}
                    </td>
                    <td>
                      {cert.fileUrl ? (
                        <a
                          href={`/api/admin/certifications/${cert.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "var(--red)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <ExternalLink size={13} /> View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${cert.status}`}>
                        {cert.status === "pending_review"
                          ? "Pending"
                          : cert.status}
                      </span>
                    </td>
                    <td>
                      {cert.status === "pending_review" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            disabled={loading === cert.id}
                            onClick={() => handleApprove(cert.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-danger"
                            disabled={loading === cert.id}
                            onClick={() => setRejectModal(cert)}
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
          title="Reject Certification"
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
            Rejecting <strong>{rejectModal.name}</strong> for{" "}
            <strong>{rejectModal.cookDisplayName}</strong>.
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="reject-cert-notes">
              Rejection Notes <span className="required">*</span>
            </label>
            <textarea
              id="reject-cert-notes"
              className="form-textarea"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Explain why this certificate is being rejected…"
              rows={3}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
