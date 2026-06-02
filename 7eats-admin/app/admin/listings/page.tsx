export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookProfiles } from "@/db/schema/cooks";
import { listings } from "@/db/schema/listings";
import { ListingsClient } from "./ListingsClient";

export const metadata = { title: "Listing Moderation" };

export default async function ListingsPage() {
  const result = await db
    .select({
      id: listings.id,
      title: listings.title,
      basePrice: listings.basePrice,
      minOrderQty: listings.minOrderQty,
      maxOrderQty: listings.maxOrderQty,
      status: listings.status,
      createdAt: listings.createdAt,
      cookId: listings.cookId,
      cookDisplayName: cookProfiles.displayName,
      userEmail: authUser.email,
    })
    .from(listings)
    .leftJoin(cookProfiles, eq(cookProfiles.id, listings.cookId))
    .leftJoin(authUser, eq(authUser.id, cookProfiles.userId))
    .orderBy(desc(listings.createdAt));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Listing Moderation</h1>
          <p className="page-subtitle">
            Approve or reject cook listings before they go live
          </p>
        </div>
      </div>
      <ListingsClient listings={result} />
    </div>
  );
}
