export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { cookApplications } from "@/db/schema/applications";
import { ApplicationActions } from "./ApplicationActions";
import styles from "./application-detail.module.css";

export const metadata = { title: "Application Detail" };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [app] = await db
    .select()
    .from(cookApplications)
    .where(eq(cookApplications.id, id))
    .limit(1);

  if (!app) notFound();

  return (
    <div>
      <Link href="/admin/applications" className="back-link">
        <ArrowLeft size={14} />
        Back to Applications
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{app.kitchenName}</h1>
          <p className="page-subtitle">Application ID: {app.id.slice(0, 8)}…</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            className={`badge badge-${app.status}`}
            style={{ fontSize: 13, padding: "5px 14px" }}
          >
            {app.status === "pending_review"
              ? "Pending Review"
              : app.status.charAt(0).toUpperCase() + app.status.slice(1)}
          </span>
          <ApplicationActions application={app} />
        </div>
      </div>

      <div className="section-gap">
        {/* Kitchen Info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Kitchen Information</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <Field label="Kitchen Name" value={app.kitchenName} />
              <Field label="Kitchen Type" value={app.kitchenType} />
              <Field label="Years Operating" value={app.yearsOperating} />
              <Field label="Business Phone" value={app.businessPhone} />
              <Field label="Business Email" value={app.businessEmail} />
              {app.website && <Field label="Website" value={app.website} />}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Address</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <Field label="Street Address" value={app.streetAddress} />
              <Field label="City" value={app.city} />
              <Field label="Province" value={app.province} />
              <Field label="Postal Code" value={app.postalCode} />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Contact Person</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <Field label="First Name" value={app.contactFirstName} />
              <Field label="Last Name" value={app.contactLastName} />
              <Field label="Role" value={app.contactRole} />
              <Field label="Phone" value={app.contactPhone} />
              <Field label="Email" value={app.contactEmail} />
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Review Info</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <Field label="Status" value={app.status} />
              <Field
                label="Submitted"
                value={
                  app.createdAt
                    ? new Date(app.createdAt).toLocaleString("en-CA")
                    : "—"
                }
              />
              <Field
                label="Last Updated"
                value={
                  app.updatedAt
                    ? new Date(app.updatedAt).toLocaleString("en-CA")
                    : "—"
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className={styles.field}>
      <span className="detail-field-label">{label}</span>
      <span className={`detail-field-value ${!value ? "is-empty" : ""}`}>
        {value || "Not provided"}
      </span>
    </div>
  );
}
