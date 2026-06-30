import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { dishes } from "@/db/schema/dishes";
import { auth } from "@/lib/auth";

// Dishes have no pending/rejected moderation state (status is draft|active|archived).
// The only admin moderation lever is taking a dish down (archive) or restoring it
// (active). Archiving removes it from every active listing's public visibility.
const schema = z.object({
  status: z.enum(["active", "archived"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dishId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [dish] = await db
    .select({ id: dishes.id })
    .from(dishes)
    .where(eq(dishes.id, dishId))
    .limit(1);

  if (!dish) {
    return NextResponse.json({ error: "Dish not found" }, { status: 404 });
  }

  await db
    .update(dishes)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(dishes.id, dishId));

  return NextResponse.json({ ok: true });
}
