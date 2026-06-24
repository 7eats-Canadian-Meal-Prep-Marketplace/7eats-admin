import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cookProfiles } from "@/db/schema/cooks";
import { cookAgreements } from "@/db/schema/payments";
import { auth } from "@/lib/auth";

const schema = z.object({
  platformFeePct: z
    .number()
    .min(0.5, "Fee must be at least 0.5%")
    .max(7.5, "Fee cannot exceed 7.5%")
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9,
      "Fee can have at most 2 decimal places",
    ),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cookId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cookId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const [cook] = await db
    .select()
    .from(cookProfiles)
    .where(eq(cookProfiles.id, cookId))
    .limit(1);

  if (!cook) {
    return NextResponse.json({ error: "Cook not found" }, { status: 404 });
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(cookProfiles)
      .set({
        platformFeePct: String(parsed.data.platformFeePct),
        updatedAt: now,
      })
      .where(eq(cookProfiles.id, cookId));

    await tx.insert(cookAgreements).values({
      cookId,
      platformFeePct: String(parsed.data.platformFeePct),
      effectiveFrom: now,
      notes: parsed.data.notes,
      createdBy: session.user.id,
    });
  });

  return NextResponse.json({ ok: true });
}
