"use client";

import { Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { discountStatus } from "@/lib/discounts/status";
import { DiscountForm } from "./DiscountForm";
import styles from "./discounts.module.css";

export type DiscountRow = {
  id: string;
  name: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  value: string;
  maxDiscountAmount: string | null;
  minOrderSubtotal: string | null;
  perUserLimit: number;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  isActive: boolean;
  redemptions: number;
};

function toDate(v: string | Date | null): Date | null {
  return v == null ? null : v instanceof Date ? v : new Date(v);
}

function formatValue(d: DiscountRow): string {
  return d.discountType === "percentage"
    ? `${Number.parseFloat(d.value)}% off`
    : `$${Number.parseFloat(d.value).toFixed(2)} off`;
}

function formatWindow(d: DiscountRow): string {
  const s = toDate(d.startsAt);
  const e = toDate(d.endsAt);
  const fmt = (x: Date) => x.toLocaleDateString("en-CA");
  if (!s && !e) return "Always";
  if (s && e) return `${fmt(s)} – ${fmt(e)}`;
  if (s) return `From ${fmt(s)}`;
  return `Until ${fmt(e as Date)}`;
}

export function DiscountsClient({
  initialDiscounts,
}: {
  initialDiscounts: DiscountRow[];
}) {
  const router = useRouter();
  const [discounts] = useState<DiscountRow[]>(initialDiscounts);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountRow | null>(null);
  const now = new Date();

  async function handleDelete(d: DiscountRow) {
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/discounts/${d.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error((j as { error?: string }).error ?? "Could not delete");
      return;
    }
    toast.success("Discount deleted");
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Tag size={20} strokeWidth={2} /> Discounts
          </h1>
          <p className={styles.subtitle}>
            Platform-funded promotions applied automatically at checkout.
          </p>
        </div>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          New discount
        </button>
      </header>

      {discounts.length === 0 ? (
        <p className={styles.empty}>No discounts yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Discount</th>
              <th>Window</th>
              <th>Per user</th>
              <th>Redemptions</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => {
              const status = discountStatus(
                {
                  isActive: d.isActive,
                  startsAt: toDate(d.startsAt),
                  endsAt: toDate(d.endsAt),
                },
                now,
              );
              return (
                <tr key={d.id}>
                  <td>
                    <div className={styles.name}>{d.name}</div>
                    {d.description && (
                      <div className={styles.desc}>{d.description}</div>
                    )}
                  </td>
                  <td>{formatValue(d)}</td>
                  <td>{formatWindow(d)}</td>
                  <td>{d.perUserLimit}</td>
                  <td>{d.redemptions}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[status]}`}>
                      {status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => {
                          setEditing(d);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(d)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {formOpen && (
        <DiscountForm
          existing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
