export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookProfiles } from "@/db/schema/cooks";
import { reviews } from "@/db/schema/orders";
import { ReviewsClient } from "./ReviewsClient";

export const metadata = { title: "Review Moderation" };

export default async function ReviewsPage() {
  const result = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      isVisible: reviews.isVisible,
      createdAt: reviews.createdAt,
      cookId: reviews.cookId,
      clientId: reviews.clientId,
      cookDisplayName: cookProfiles.displayName,
      clientEmail: authUser.email,
    })
    .from(reviews)
    .leftJoin(cookProfiles, eq(cookProfiles.id, reviews.cookId))
    .leftJoin(authUser, eq(authUser.id, reviews.clientId))
    .orderBy(desc(reviews.createdAt));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Review Moderation</h1>
          <p className="page-subtitle">Hide or show customer reviews</p>
        </div>
      </div>
      <ReviewsClient reviews={result} />
    </div>
  );
}
