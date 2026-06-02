export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookCertifications, cookProfiles } from "@/db/schema/cooks";
import { listings } from "@/db/schema/listings";
import { orders } from "@/db/schema/orders";
import { cookAgreements, cookPayouts } from "@/db/schema/payments";
import { CookDetailTabs } from "./CookDetailTabs";

export const metadata = { title: "Cook Detail" };

export default async function CookDetailPage({
  params,
}: {
  params: Promise<{ cookId: string }>;
}) {
  const { cookId } = await params;

  const [cook] = await db
    .select()
    .from(cookProfiles)
    .where(eq(cookProfiles.id, cookId))
    .limit(1);

  if (!cook) notFound();

  const [user] = await db
    .select()
    .from(authUser)
    .where(eq(authUser.id, cook.userId))
    .limit(1);

  const [certs, cookListings, cookOrders, payouts, agreements] =
    await Promise.all([
      db
        .select()
        .from(cookCertifications)
        .where(eq(cookCertifications.cookId, cookId))
        .orderBy(desc(cookCertifications.createdAt)),
      db
        .select()
        .from(listings)
        .where(eq(listings.cookId, cookId))
        .orderBy(desc(listings.createdAt))
        .limit(50),
      db
        .select()
        .from(orders)
        .where(eq(orders.cookId, cookId))
        .orderBy(desc(orders.createdAt))
        .limit(20),
      db
        .select()
        .from(cookPayouts)
        .where(eq(cookPayouts.cookId, cookId))
        .orderBy(desc(cookPayouts.createdAt))
        .limit(20),
      db
        .select()
        .from(cookAgreements)
        .where(eq(cookAgreements.cookId, cookId))
        .orderBy(desc(cookAgreements.createdAt))
        .limit(20),
    ]);

  return (
    <div>
      <Link href="/admin/cooks" className="back-link">
        <ArrowLeft size={14} />
        Back to Cooks
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{cook.displayName}</h1>
          <p className="page-subtitle">{user?.email ?? "No email"}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className={`badge badge-${user?.status ?? "pending"}`}
            style={{ fontSize: 13, padding: "5px 14px" }}
          >
            {user?.status ?? "pending"}
          </span>
        </div>
      </div>

      <CookDetailTabs
        cook={cook}
        user={user ?? null}
        certifications={certs}
        listings={cookListings}
        orders={cookOrders}
        payouts={payouts}
        agreements={agreements}
      />
    </div>
  );
}
