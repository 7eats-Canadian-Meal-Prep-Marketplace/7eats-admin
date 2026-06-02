"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Cook = {
  id: string;
  displayName: string;
  setupComplete: boolean;
  currentSetupStep: number;
  platformFeePct: string | null;
  createdAt: Date | null;
  userId: string;
  userEmail: string | null;
  userStatus: string | null;
  userFirstName: string | null;
  userLastName: string | null;
};

const STATUS_FILTERS = [
  "all",
  "active",
  "pending",
  "suspended",
  "banned",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function CooksClient({ cooks }: { cooks: Cook[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let list = cooks;
    if (statusFilter !== "all") {
      list = list.filter((c) => c.userStatus === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.displayName?.toLowerCase().includes(q) ||
          c.userEmail?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [cooks, search, statusFilter]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="filters-bar">
          <div className="search-input-wrap">
            <Search size={16} className="search-input-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search cooks"
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
        <span style={{ fontSize: 13, color: "var(--grey-700)" }}>
          {filtered.length} cook{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No cooks found</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Email</th>
                <th>Setup</th>
                <th>Fee %</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cook) => (
                <tr key={cook.id} className="is-clickable">
                  <td>
                    <Link
                      href={`/admin/cooks/${cook.id}`}
                      style={{
                        fontWeight: 600,
                        color: "var(--ink)",
                        textDecoration: "none",
                      }}
                    >
                      {cook.displayName}
                    </Link>
                  </td>
                  <td className="table-cell-muted">{cook.userEmail ?? "—"}</td>
                  <td>
                    {cook.setupComplete ? (
                      <span className="badge badge-active">Complete</span>
                    ) : (
                      <span className="badge badge-pending">
                        Step {cook.currentSetupStep}/4
                      </span>
                    )}
                  </td>
                  <td className="table-cell-muted">
                    {cook.platformFeePct ?? "7.5"}%
                  </td>
                  <td>
                    <span
                      className={`badge badge-${cook.userStatus ?? "pending"}`}
                    >
                      {cook.userStatus ?? "pending"}
                    </span>
                  </td>
                  <td className="table-cell-muted">
                    {cook.createdAt
                      ? new Date(cook.createdAt).toLocaleDateString("en-CA")
                      : "—"}
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
