import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { auth } from "@/lib/auth";

const schema = z.object({
  status: z.enum(["active", "rejected"]),
  reviewNotes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listingId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const newStatus = parsed.data.status === "rejected" ? "archived" : "active";

  await db
    .update(listings)
    .set({
      status: newStatus,
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
      reviewNotes: parsed.data.reviewNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));

  return NextResponse.json({ ok: true });
}
