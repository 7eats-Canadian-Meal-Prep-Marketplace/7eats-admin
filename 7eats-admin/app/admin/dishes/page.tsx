export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookProfiles } from "@/db/schema/cooks";
import { dishes } from "@/db/schema/dishes";
import { DishesClient } from "./DishesClient";

export const metadata = { title: "Dishes" };

export default async function DishesPage() {
  const result = await db
    .select({
      id: dishes.id,
      name: dishes.name,
      price: dishes.price,
      status: dishes.status,
      cuisine: dishes.cuisine,
      createdAt: dishes.createdAt,
      cookId: dishes.cookId,
      cookDisplayName: cookProfiles.displayName,
      userEmail: authUser.email,
    })
    .from(dishes)
    .leftJoin(cookProfiles, eq(cookProfiles.id, dishes.cookId))
    .leftJoin(authUser, eq(authUser.id, cookProfiles.userId))
    .orderBy(desc(dishes.createdAt));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dishes</h1>
          <p className="page-subtitle">
            Browse every cook&apos;s dishes and take down or restore any item
          </p>
        </div>
      </div>
      <DishesClient dishes={result} />
    </div>
  );
}
