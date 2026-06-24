import { count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
import { orders } from "@/db/schema/orders";
import { auth } from "@/lib/auth";
import { discountInputSchema } from "@/lib/discounts/schema";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return null;
  }
  return session;
}

function toNumericString(n: number | null | undefined): string | null {
  return n == null ? null : String(n.toFixed(2));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = discountInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const result = await db
    .update(platformDiscounts)
    .set({
      name: d.name,
      description: d.description ?? null,
      discountType: d.discountType,
      value: String(d.value.toFixed(2)),
      maxDiscountAmount: toNumericString(d.maxDiscountAmount),
      minOrderSubtotal: toNumericString(d.minOrderSubtotal),
      perUserLimit: d.perUserLimit,
      startsAt: d.startsAt ?? null,
      endsAt: d.endsAt ?? null,
      isActive: d.isActive,
    })
    .where(eq(platformDiscounts.id, id))
    .returning({ id: platformDiscounts.id });
  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [{ used }] = await db
    .select({ used: count() })
    .from(orders)
    .where(eq(orders.platformDiscountId, id));
  if (Number(used) > 0) {
    return NextResponse.json(
      { error: "Discount is referenced by orders; deactivate it instead." },
      { status: 409 },
    );
  }
  await db.delete(platformDiscounts).where(eq(platformDiscounts.id, id));
  return NextResponse.json({ ok: true });
}
