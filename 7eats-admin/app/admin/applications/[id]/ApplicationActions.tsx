"use client";
import type { InferSelectModel } from "drizzle-orm";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/admin/Modal";
import type { cookApplications } from "@/db/schema/applications";

type Application = InferSelectModel<typeof cookApplications>;

export function ApplicationActions({
  application,
}: {
  application: Application;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"approve" | "reject" | "reissue" | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function closeModal() {
    setModal(null);
    setNotes("");
    setError("");
  }

  async function handleApprove() {
    setLoading(true);
    setError("");
    const res = await fetch(
      `/api/admin/applications/${application.id}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      },
    );
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        (data as { error?: string }).error ?? "Failed to approve application",
      );
      return;
    }
    toast.success(
      `Application approved. Setup link sent to ${application.contactEmail}.`,
    );
    closeModal();
    router.refresh();
  }

  async function handleReject() {
    if (!notes.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(
      `/api/admin/applications/${application.id}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: notes }),
      },
    );
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        (data as { error?: string }).error ?? "Failed to reject application",
      );
      return;
    }
    toast.success("Application rejected.");
    closeModal();
    router.refresh();
  }

  async function handleReissue() {
    setLoading(true);
    setError("");
    const res = await fetch(
      `/api/admin/applications/${application.id}/reissue-link`,
      {
        method: "POST",
      },
    );
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Failed to reissue link");
      return;
    }
    toast.success(`New setup link sent to ${application.contactEmail}.`);
    closeModal();
  }

  const isPending = application.status === "pending_review";
  const isApproved = application.status === "approved";

  return (
    <>
      <div style={{ display: "flex", gap: 10 }}>
        {isPending && (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setModal("approve")}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setModal("reject")}
            >
              Reject
            </button>
          </>
        )}
        {isApproved && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setModal("reissue")}
          >
            Reissue Setup Link
          </button>
        )}
      </div>

      {modal === "approve" && (
        <Modal
          title="Approve Application"
          titleId="modal-approve-title"
          onClose={closeModal}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-primary ${loading ? "btn-loading" : ""}`}
                onClick={handleApprove}
                disabled={loading}
              >
                {loading ? "Approving…" : "Approve & Send Link"}
              </button>
            </>
          }
        >
          <p
            style={{ fontSize: 14, color: "var(--grey-700)", marginBottom: 16 }}
          >
            Approve <strong>{application.kitchenName}</strong>? A setup link
            will be sent to <strong>{application.contactEmail}</strong>.
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="approve-notes">
              Notes (optional)
            </label>
            <textarea
              id="approve-notes"
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes for this approval…"
              rows={3}
            />
          </div>
          {error && (
            <p className="form-error" role="alert" style={{ marginTop: 8 }}>
              {error}
            </p>
          )}
        </Modal>
      )}

      {modal === "reject" && (
        <Modal
          title="Reject Application"
          titleId="modal-reject-title"
          onClose={closeModal}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-danger ${loading ? "btn-loading" : ""}`}
                onClick={handleReject}
                disabled={loading}
              >
                {loading ? "Rejecting…" : "Reject Application"}
              </button>
            </>
          }
        >
          <p
            style={{ fontSize: 14, color: "var(--grey-700)", marginBottom: 16 }}
          >
            Reject <strong>{application.kitchenName}</strong>? A rejection email
            will be sent to <strong>{application.contactEmail}</strong>.
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="reject-reason">
              Rejection Reason <span className="required">*</span>
            </label>
            <textarea
              id="reject-reason"
              className={`form-textarea ${error ? "is-error" : ""}`}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setError("");
              }}
              placeholder="Explain why this application is being rejected…"
              rows={4}
              required
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}

      {modal === "reissue" && (
        <Modal
          title="Reissue Setup Link"
          titleId="modal-reissue-title"
          onClose={closeModal}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${loading ? "btn-loading" : ""}`}
                onClick={handleReissue}
                disabled={loading}
              >
                {loading ? "Sending…" : "Send New Link"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "var(--grey-700)" }}>
            Send a new setup link to <strong>{application.contactEmail}</strong>
            ? Previous links will be invalidated.
          </p>
          {error && (
            <p className="form-error" role="alert" style={{ marginTop: 8 }}>
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
