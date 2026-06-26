"use client";
import type { InferSelectModel } from "drizzle-orm";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { cookApplications } from "@/db/schema/applications";
import { formatDate } from "@/lib/format";

type Application = InferSelectModel<typeof cookApplications>;

const STATUS_FILTERS = [
  "all",
  "pending_review",
  "approved",
  "rejected",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function ApplicationsClient({
  applications,
}: {
  applications: Application[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.kitchenName.toLowerCase().includes(q) ||
          a.contactEmail.toLowerCase().includes(q),
      );
    }
    return list;
  }, [applications, search, statusFilter]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <div className="search-input-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                type="search"
                className="search-input"
                placeholder="Search kitchen or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search applications"
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
          <span style={{ fontSize: 13, color: "var(--grey-700)" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Search size={20} />
              </div>
              <p className="empty-state-title">No applications found</p>
              <p className="empty-state-desc">
                Try adjusting your search or filter.
              </p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kitchen Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Submitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr key={app.id} className="is-clickable">
                    <td>
                      <Link
                        href={`/admin/applications/${app.id}`}
                        style={{
                          fontWeight: 600,
                          color: "var(--ink)",
                          textDecoration: "none",
                        }}
                      >
                        {app.kitchenName}
                      </Link>
                    </td>
                    <td>
                      {app.contactFirstName} {app.contactLastName}
                    </td>
                    <td className="table-cell-muted">{app.contactEmail}</td>
                    <td className="table-cell-muted">{app.city}</td>
                    <td className="table-cell-muted">
                      {app.createdAt ? formatDate(app.createdAt) : "—"}
                    </td>
                    <td>
                      <span className={`badge badge-${app.status}`}>
                        {app.status === "pending_review"
                          ? "Pending"
                          : app.status.charAt(0).toUpperCase() +
                            app.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
