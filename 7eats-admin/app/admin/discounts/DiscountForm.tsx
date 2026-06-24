"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/admin/Modal";
import type { DiscountRow } from "./DiscountsClient";
import styles from "./discounts.module.css";

type Props = {
  onClose: () => void;
  onSaved: () => void;
  existing?: DiscountRow | null;
};

function dateInputValue(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

export function DiscountForm({ onClose, onSaved, existing }: Props) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    existing?.discountType ?? "fixed",
  );
  const [value, setValue] = useState(existing ? existing.value : "");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(
    existing?.maxDiscountAmount ?? "",
  );
  const [minOrderSubtotal, setMinOrderSubtotal] = useState(
    existing?.minOrderSubtotal ?? "",
  );
  const [perUserLimit, setPerUserLimit] = useState(
    String(existing?.perUserLimit ?? 1),
  );
  const [startsAt, setStartsAt] = useState(dateInputValue(existing?.startsAt));
  const [endsAt, setEndsAt] = useState(dateInputValue(existing?.endsAt));
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      discountType,
      value: Number.parseFloat(value as string),
      maxDiscountAmount:
        discountType === "percentage" && maxDiscountAmount
          ? Number.parseFloat(maxDiscountAmount as string)
          : null,
      minOrderSubtotal: minOrderSubtotal
        ? Number.parseFloat(minOrderSubtotal as string)
        : null,
      perUserLimit: Number.parseInt(perUserLimit, 10),
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      isActive,
    };
    const url = existing
      ? `/api/admin/discounts/${existing.id}`
      : "/api/admin/discounts";
    const method = existing ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(
          (j as { error?: string }).error ?? "Failed to save discount",
        );
        return;
      }
      toast.success(existing ? "Discount updated" : "Discount created");
      onSaved();
      onClose();
    } catch {
      toast.error("Network error saving discount");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={existing ? "Edit discount" : "New discount"}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label className={styles.field}>
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </label>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Type</span>
            <select
              value={discountType}
              onChange={(e) =>
                setDiscountType(e.target.value as "percentage" | "fixed")
              }
            >
              <option value="fixed">$ off</option>
              <option value="percentage">% off</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>
              {discountType === "percentage" ? "Percent" : "Amount ($)"}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={value as string}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </label>
        </div>
        {discountType === "percentage" && (
          <label className={styles.field}>
            <span>Max discount cap ($, optional)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={maxDiscountAmount as string}
              onChange={(e) => setMaxDiscountAmount(e.target.value)}
            />
          </label>
        )}
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Min order subtotal ($, optional)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={minOrderSubtotal as string}
              onChange={(e) => setMinOrderSubtotal(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Per-user limit</span>
            <input
              type="number"
              min="1"
              step="1"
              value={perUserLimit}
              onChange={(e) => setPerUserLimit(e.target.value)}
              required
            />
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Starts at (optional)</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Ends at (optional)</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </div>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Active</span>
        </label>
        <div className={styles.formActions}>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={styles.newBtn}>
            {saving ? "Saving…" : existing ? "Save changes" : "Create discount"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
