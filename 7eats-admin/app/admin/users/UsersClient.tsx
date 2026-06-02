"use client";
import type { InferSelectModel } from "drizzle-orm";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { authUser } from "@/db/schema/auth";

type User = InferSelectModel<typeof authUser>;

const ROLE_FILTERS = ["all", "client", "cook", "admin"] as const;
const STATUS_FILTERS = [
  "all",
  "active",
  "pending",
  "suspended",
  "banned",
] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function UsersClient({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (statusFilter !== "all")
      list = list.filter((u) => u.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [users, roleFilter, statusFilter, search]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="filters-bar" style={{ flexWrap: "wrap" }}>
          <div className="search-input-wrap">
            <Search size={16} className="search-input-icon" />
            <input
              type="search"
              className="search-input"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
            />
          </div>
          <div className="filter-tabs">
            {ROLE_FILTERS.map((r) => (
              <button
                key={r}
                type="button"
                className={`filter-tab ${roleFilter === r ? "is-active" : ""}`}
                onClick={() => setRoleFilter(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
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
        <span style={{ fontSize: 13, color: "var(--grey-700)", flexShrink: 0 }}>
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No users found</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Phone Verified</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="is-clickable">
                  <td>
                    <Link
                      href={`/admin/users/${user.id}`}
                      style={{
                        fontWeight: 600,
                        color: "var(--ink)",
                        textDecoration: "none",
                      }}
                    >
                      {user.name ?? "—"}
                    </Link>
                  </td>
                  <td className="table-cell-muted">{user.email}</td>
                  <td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background:
                          user.role === "admin"
                            ? "#fdeeed"
                            : user.role === "cook"
                              ? "#eefbf3"
                              : "#eaf4fb",
                        color:
                          user.role === "admin"
                            ? "var(--red)"
                            : user.role === "cook"
                              ? "var(--status-approved)"
                              : "#2980b9",
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${user.status}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="table-cell-muted">
                    {user.phoneVerified ? "✓" : "—"}
                  </td>
                  <td className="table-cell-muted">
                    {new Date(user.createdAt).toLocaleDateString("en-CA")}
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
