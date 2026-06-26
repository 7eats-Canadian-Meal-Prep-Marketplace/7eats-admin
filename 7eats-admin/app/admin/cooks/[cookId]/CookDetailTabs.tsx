"use client";
import type { InferSelectModel } from "drizzle-orm";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/admin/Modal";
import type { authUser } from "@/db/schema/auth";
import type { cookCertifications, cookProfiles } from "@/db/schema/cooks";
import type { listings } from "@/db/schema/listings";
import type { orders } from "@/db/schema/orders";
import type { cookAgreements, cookPayouts } from "@/db/schema/payments";
import { formatDate } from "@/lib/format";

type Cook = InferSelectModel<typeof cookProfiles>;
type User = InferSelectModel<typeof authUser>;
type Cert = InferSelectModel<typeof cookCertifications>;
type Listing = InferSelectModel<typeof listings>;
type Order = InferSelectModel<typeof orders>;
type Payout = InferSelectModel<typeof cookPayouts>;
type Agreement = InferSelectModel<typeof cookAgreements>;

const TABS = [
  "Profile",
  "Certifications",
  "Listings",
  "Orders",
  "Payouts",
  "Fee History",
] as const;
type Tab = (typeof TABS)[number];

function fmtMoney(n: string | null | undefined) {
  if (!n) return "$0.00";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(n));
}

export function CookDetailTabs({
  cook,
  user,
  certifications,
  listings: cookListings,
  orders: cookOrders,
  payouts,
  agreements,
}: {
  cook: Cook;
  user: User | null;
  certifications: Cert[];
  listings: Listing[];
  orders: Order[];
  payouts: Payout[];
  agreements: Agreement[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Profile");
  const [modal, setModal] = useState<
    "suspend" | "ban" | "reactivate" | "fee" | null
  >(null);
  const [feeValue, setFeeValue] = useState(
    String(cook.platformFeePct ?? "7.5"),
  );
  const [feeNotes, setFeeNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function closeModal() {
    setModal(null);
    setError("");
  }

  async function handleStatusChange(status: "active" | "suspended" | "banned") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/cooks/${cook.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Failed to update status");
      return;
    }
    toast.success(`Account ${status}.`);
    closeModal();
    router.refresh();
  }

  function handleFeeChange(value: string) {
    // Silently block anything that isn't a number with up to 2 decimals.
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setFeeValue(value);
      setError("");
    }
  }

  async function handleFeeOverride() {
    const pct = Number(feeValue);
    if (feeValue === "" || Number.isNaN(pct) || pct < 0.5 || pct > 7.5) {
      setError("Fee must be between 0.5% and 7.5%");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/cooks/${cook.id}/fee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformFeePct: pct, notes: feeNotes }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? "Failed to update fee");
      return;
    }
    toast.success("Platform fee updated.");
    closeModal();
    router.refresh();
  }

  const status = user?.status ?? "pending";

  return (
    <>
      {/* Action buttons */}
      <div
        style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}
      >
        {status !== "suspended" && status !== "banned" && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setModal("suspend")}
          >
            Suspend Account
          </button>
        )}
        {status !== "banned" && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setModal("ban")}
          >
            Ban Account
          </button>
        )}
        {(status === "suspended" || status === "banned") && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setModal("reactivate")}
          >
            Reactivate Account
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setModal("fee")}
        >
          Override Platform Fee
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            className={`tab-btn ${activeTab === t ? "is-active" : ""}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {activeTab === "Profile" && <ProfileTab cook={cook} user={user} />}
        {activeTab === "Certifications" && (
          <CertsTab certs={certifications} cookId={cook.id} />
        )}
        {activeTab === "Listings" && <ListingsTab listings={cookListings} />}
        {activeTab === "Orders" && <OrdersTab orders={cookOrders} />}
        {activeTab === "Payouts" && <PayoutsTab payouts={payouts} />}
        {activeTab === "Fee History" && (
          <FeeHistoryTab agreements={agreements} />
        )}
      </div>

      {/* Status modals */}
      {(modal === "suspend" || modal === "ban" || modal === "reactivate") && (
        <Modal
          title={
            modal === "suspend"
              ? "Suspend Account"
              : modal === "ban"
                ? "Ban Account"
                : "Reactivate Account"
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
                className={`btn ${modal === "reactivate" ? "btn-secondary" : "btn-danger"} ${loading ? "btn-loading" : ""}`}
                onClick={() =>
                  handleStatusChange(
                    modal === "suspend"
                      ? "suspended"
                      : modal === "ban"
                        ? "banned"
                        : "active",
                  )
                }
                disabled={loading}
              >
                {loading
                  ? "Updating…"
                  : modal === "suspend"
                    ? "Suspend"
                    : modal === "ban"
                      ? "Ban"
                      : "Reactivate"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "var(--grey-700)" }}>
            {modal === "suspend" &&
              `Suspend ${cook.displayName}'s account? They will lose access until reactivated.`}
            {modal === "ban" &&
              `Permanently ban ${cook.displayName}'s account? This action should be used with caution.`}
            {modal === "reactivate" &&
              `Reactivate ${cook.displayName}'s account? They will regain full access.`}
          </p>
          {error && (
            <p className="form-error" role="alert" style={{ marginTop: 8 }}>
              {error}
            </p>
          )}
        </Modal>
      )}

      {/* Fee modal */}
      {modal === "fee" && (
        <Modal
          title="Override Platform Fee"
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
                onClick={handleFeeOverride}
                disabled={loading}
              >
                {loading ? "Saving…" : "Update Fee"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 14, color: "var(--grey-700)" }}>
              Current fee: <strong>{cook.platformFeePct ?? "7.5"}%</strong>
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="fee-pct">
                New Fee (%) <span className="required">*</span>
              </label>
              <input
                id="fee-pct"
                type="text"
                inputMode="decimal"
                className={`form-input ${error ? "is-error" : ""}`}
                value={feeValue}
                onChange={(e) => handleFeeChange(e.target.value)}
                placeholder="0.5 – 7.5"
                aria-describedby="fee-pct-hint"
              />
              <p
                id="fee-pct-hint"
                style={{
                  fontSize: 12,
                  color: "var(--grey-700)",
                  marginTop: 6,
                }}
              >
                Allowed range: 0.5% to 7.5% (up to 2 decimal places).
              </p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="fee-notes">
                Notes (optional)
              </label>
              <textarea
                id="fee-notes"
                className="form-textarea"
                value={feeNotes}
                onChange={(e) => setFeeNotes(e.target.value)}
                placeholder="Reason for this fee adjustment…"
                rows={2}
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function ProfileTab({ cook, user }: { cook: Cook; user: User | null }) {
  const fields = [
    { label: "Display Name", value: cook.displayName },
    { label: "Bio", value: cook.bio },
    { label: "Pickup Address", value: cook.pickupAddress },
    { label: "Lead Time", value: cook.leadTime },
    { label: "Delivery", value: cook.delivery },
    { label: "Platform Fee %", value: `${cook.platformFeePct ?? "7.5"}%` },
    { label: "Stripe Account", value: cook.stripeAccountId },
    { label: "Setup Complete", value: cook.setupComplete ? "Yes" : "No" },
    {
      label: "TOS Accepted",
      value: cook.tosAcceptedAt ? formatDate(cook.tosAcceptedAt) : "No",
    },
    { label: "User Email", value: user?.email },
    { label: "Account Status", value: user?.status },
  ];

  return (
    <div className="card">
      <div className="card-body">
        <div className="detail-grid">
          {fields.map((f) => (
            <div key={f.label} className="detail-field">
              <span className="detail-field-label">{f.label}</span>
              <span
                className={`detail-field-value ${!f.value ? "is-empty" : ""}`}
              >
                {f.value ?? "Not set"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CertsTab({ certs }: { certs: Cert[]; cookId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleReview(
    certId: string,
    action: "approved" | "rejected",
    notes?: string,
  ) {
    setLoading(certId);
    const res = await fetch(`/api/admin/certifications/${certId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action, reviewNotes: notes }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error("Failed to update certification");
      return;
    }
    toast.success(`Certification ${action}.`);
    router.refresh();
  }

  if (certs.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">No certifications</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Holder</th>
              <th>Issuer</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((cert) => (
              <tr key={cert.id}>
                <td style={{ fontWeight: 500 }}>
                  {cert.fileUrl ? (
                    <a
                      href={cert.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--red)" }}
                    >
                      {cert.name}
                    </a>
                  ) : (
                    cert.name
                  )}
                </td>
                <td>{cert.holderName}</td>
                <td className="table-cell-muted">{cert.issuer ?? "—"}</td>
                <td className="table-cell-muted">
                  {cert.expiresAt ? formatDate(cert.expiresAt) : "—"}
                </td>
                <td>
                  <span className={`badge badge-${cert.status}`}>
                    {cert.status === "pending_review" ? "Pending" : cert.status}
                  </span>
                </td>
                <td>
                  {cert.status === "pending_review" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        disabled={loading === cert.id}
                        onClick={() => handleReview(cert.id, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-danger"
                        disabled={loading === cert.id}
                        onClick={() => {
                          const notes = window.prompt("Rejection notes:");
                          if (notes !== null)
                            handleReview(cert.id, "rejected", notes);
                        }}
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
      </div>
    </div>
  );
}

function ListingsTab({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">No listings</p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Price</th>
              <th>Min/Max Qty</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 500 }}>{l.title}</td>
                <td>{fmtMoney(l.basePrice)}</td>
                <td className="table-cell-muted">
                  {l.minOrderQty} / {l.maxOrderQty ?? "—"}
                </td>
                <td>
                  <span className={`badge badge-${l.status}`}>
                    {l.status.replace("_", " ")}
                  </span>
                </td>
                <td className="table-cell-muted">
                  {l.createdAt ? formatDate(l.createdAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersTab({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">No orders</p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Pickup</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <a
                    href={`/admin/orders/${o.id}`}
                    style={{
                      fontWeight: 500,
                      color: "var(--ink)",
                      textDecoration: "none",
                    }}
                  >
                    #{o.id.slice(0, 8)}
                  </a>
                </td>
                <td>{fmtMoney(o.totalPrice)}</td>
                <td>
                  <span className={`badge badge-${o.status}`}>{o.status}</span>
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
      </div>
    </div>
  );
}

function PayoutsTab({ payouts }: { payouts: Payout[] }) {
  if (payouts.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">No payouts</p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Amount</th>
              <th>Status</th>
              <th>Arrival Date</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{fmtMoney(p.amount)}</td>
                <td>
                  <span className={`badge badge-${p.status}`}>{p.status}</span>
                </td>
                <td className="table-cell-muted">
                  {p.arrivalDate ? formatDate(p.arrivalDate) : "—"}
                </td>
                <td className="table-cell-muted">
                  {p.createdAt ? formatDate(p.createdAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeeHistoryTab({ agreements }: { agreements: Agreement[] }) {
  if (agreements.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">No fee history</p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Fee %</th>
              <th>Effective From</th>
              <th>Effective Until</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{a.platformFeePct}%</td>
                <td className="table-cell-muted">
                  {a.effectiveFrom ? formatDate(a.effectiveFrom) : "—"}
                </td>
                <td className="table-cell-muted">
                  {a.effectiveUntil ? formatDate(a.effectiveUntil) : "Current"}
                </td>
                <td className="table-cell-muted">{a.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
