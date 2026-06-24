import { desc } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platformDiscounts } from "@/db/schema/discounts";
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

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(platformDiscounts)
    .orderBy(desc(platformDiscounts.createdAt));
  return NextResponse.json({ discounts: rows });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = discountInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const [created] = await db
    .insert(platformDiscounts)
    .values({
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
      createdBy: session.user.id,
    })
    .returning({ id: platformDiscounts.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
