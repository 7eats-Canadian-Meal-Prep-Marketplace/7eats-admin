export const dynamic = "force-dynamic";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { cookApplications } from "@/db/schema/applications";
import { ApplicationsClient } from "./ApplicationsClient";

export const metadata = { title: "Cook Applications" };

export default async function ApplicationsPage() {
  const applications = await db
    .select()
    .from(cookApplications)
    .orderBy(desc(cookApplications.createdAt));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cook Applications</h1>
          <p className="page-subtitle">
            Review and approve incoming cook applications
          </p>
        </div>
      </div>
      <ApplicationsClient applications={applications} />
    </div>
  );
}
