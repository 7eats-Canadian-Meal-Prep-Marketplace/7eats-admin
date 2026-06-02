export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookCertifications, cookProfiles } from "@/db/schema/cooks";
import { CertificationsClient } from "./CertificationsClient";

export const metadata = { title: "Certification Review" };

export default async function CertificationsPage() {
  const certs = await db
    .select({
      id: cookCertifications.id,
      name: cookCertifications.name,
      holderName: cookCertifications.holderName,
      issuer: cookCertifications.issuer,
      expiresAt: cookCertifications.expiresAt,
      fileUrl: cookCertifications.fileUrl,
      status: cookCertifications.status,
      reviewedAt: cookCertifications.reviewedAt,
      reviewNotes: cookCertifications.reviewNotes,
      createdAt: cookCertifications.createdAt,
      cookId: cookCertifications.cookId,
      cookDisplayName: cookProfiles.displayName,
      userEmail: authUser.email,
    })
    .from(cookCertifications)
    .leftJoin(cookProfiles, eq(cookProfiles.id, cookCertifications.cookId))
    .leftJoin(authUser, eq(authUser.id, cookProfiles.userId))
    .orderBy(desc(cookCertifications.createdAt));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Certification Review</h1>
          <p className="page-subtitle">
            Approve or reject Food Handler certificates
          </p>
        </div>
      </div>
      <CertificationsClient certifications={certs} />
    </div>
  );
}
