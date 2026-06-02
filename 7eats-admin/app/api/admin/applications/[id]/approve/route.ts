import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cookApplications, setupTokens } from "@/db/schema/applications";
import { auth } from "@/lib/auth";
import { sendSetupEmail } from "@/lib/email";

const schema = z.object({
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [application] = await db
    .select()
    .from(cookApplications)
    .where(eq(cookApplications.id, id))
    .limit(1);

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 },
    );
  }

  if (application.status === "approved") {
    return NextResponse.json(
      { error: "Application is already approved." },
      { status: 409 },
    );
  }

  if (application.status !== "pending_review") {
    return NextResponse.json(
      { error: "Application is not in pending_review status." },
      { status: 409 },
    );
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .insert(setupTokens)
      .values({ applicationId: id, tokenHash, expiresAt });
    await tx
      .update(cookApplications)
      .set({ status: "approved" })
      .where(eq(cookApplications.id, id));
  });

  try {
    await sendSetupEmail(
      application.contactEmail,
      application.kitchenName,
      rawToken,
    );
  } catch (err) {
    console.error("[approve] Resend failed:", err);
    // Compensate: delete the orphaned token and revert status so team can retry
    await db.transaction(async (tx) => {
      await tx.delete(setupTokens).where(eq(setupTokens.tokenHash, tokenHash));
      await tx
        .update(cookApplications)
        .set({ status: "pending_review" })
        .where(eq(cookApplications.id, id));
    });
    return NextResponse.json(
      {
        error:
          "Email delivery failed. Application reverted to pending_review. Retry when ready.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
