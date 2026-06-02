"use client";
import type { InferSelectModel } from "drizzle-orm";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/admin/Modal";
import type { authUser } from "@/db/schema/auth";

type User = InferSelectModel<typeof authUser>;
type ModalType = "suspend" | "ban" | "reactivate" | "promote" | "demote";

export function UserActions({ user }: { user: User }) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function closeModal() {
    setModal(null);
    setError("");
  }

  async function handleStatusChange(status: "active" | "suspended" | "banned") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/users/${user.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Failed");
      return;
    }
    toast.success(`Account ${status}.`);
    closeModal();
    router.refresh();
  }

  async function handleRoleChange(role: "admin" | "client" | "cook") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/users/${user.id}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Failed");
      return;
    }
    toast.success(`Role changed to ${role}.`);
    closeModal();
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {user.status === "active" && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setModal("suspend")}
          >
            Suspend
          </button>
        )}
        {user.status !== "banned" && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setModal("ban")}
          >
            Ban
          </button>
        )}
        {(user.status === "suspended" || user.status === "banned") && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setModal("reactivate")}
          >
            Reactivate
          </button>
        )}
        {user.role !== "admin" && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setModal("promote")}
          >
            Promote to Admin
          </button>
        )}
        {user.role === "admin" && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setModal("demote")}
          >
            Demote to Client
          </button>
        )}
      </div>

      {modal && (
        <Modal
          title={
            modal === "suspend"
              ? "Suspend User"
              : modal === "ban"
                ? "Ban User"
                : modal === "reactivate"
                  ? "Reactivate User"
                  : modal === "promote"
                    ? "Promote to Admin"
                    : "Demote to Client"
          }
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
                className={`btn ${modal === "ban" ? "btn-danger" : modal === "promote" ? "btn-primary" : "btn-secondary"} ${loading ? "btn-loading" : ""}`}
                disabled={loading}
                onClick={() => {
                  if (modal === "suspend") handleStatusChange("suspended");
                  else if (modal === "ban") handleStatusChange("banned");
                  else if (modal === "reactivate") handleStatusChange("active");
                  else if (modal === "promote") handleRoleChange("admin");
                  else if (modal === "demote") handleRoleChange("client");
                }}
              >
                {loading ? "Updating…" : "Confirm"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "var(--grey-700)" }}>
            {modal === "suspend" &&
              `Suspend ${user.email}'s account? They will lose access until reactivated.`}
            {modal === "ban" && `Permanently ban ${user.email}?`}
            {modal === "reactivate" && `Reactivate ${user.email}'s account?`}
            {modal === "promote" &&
              `Promote ${user.email} to admin? They will have full admin access.`}
            {modal === "demote" && `Demote ${user.email} to client role?`}
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
