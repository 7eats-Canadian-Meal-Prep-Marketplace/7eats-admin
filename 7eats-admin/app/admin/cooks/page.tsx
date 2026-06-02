export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookProfiles } from "@/db/schema/cooks";
import { CooksClient } from "./CooksClient";

export const metadata = { title: "Cook Management" };

export default async function CooksPage() {
  const cooks = await db
    .select({
      id: cookProfiles.id,
      displayName: cookProfiles.displayName,
      setupComplete: cookProfiles.setupComplete,
      currentSetupStep: cookProfiles.currentSetupStep,
      platformFeePct: cookProfiles.platformFeePct,
      createdAt: cookProfiles.createdAt,
      userId: cookProfiles.userId,
      userEmail: authUser.email,
      userStatus: authUser.status,
      userFirstName: authUser.firstName,
      userLastName: authUser.lastName,
    })
    .from(cookProfiles)
    .leftJoin(authUser, eq(authUser.id, cookProfiles.userId))
    .orderBy(desc(cookProfiles.createdAt));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cook Management</h1>
          <p className="page-subtitle">
            Manage cook accounts, statuses, and platform fees
          </p>
        </div>
      </div>
      <CooksClient cooks={cooks} />
    </div>
  );
}
