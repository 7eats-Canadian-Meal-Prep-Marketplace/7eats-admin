import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cookApplications, setupTokens } from "@/db/schema/applications";
import { auth } from "@/lib/auth";
import { sendSetupEmail } from "@/lib/email";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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

  if (application.status !== "approved") {
    return NextResponse.json(
      { error: "Application must be approved before re-issuing a link." },
      { status: 409 },
    );
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  // Expire all existing unconsumed tokens then insert the fresh one
  await db.transaction(async (tx) => {
    await tx
      .update(setupTokens)
      .set({ expiresAt: new Date() })
      .where(
        and(eq(setupTokens.applicationId, id), isNull(setupTokens.consumedAt)),
      );
    await tx
      .insert(setupTokens)
      .values({ applicationId: id, tokenHash, expiresAt });
  });

  try {
    await sendSetupEmail(
      application.contactEmail,
      application.kitchenName,
      rawToken,
    );
  } catch (err) {
    console.error("[reissue-link] Resend failed:", err);
    await db.delete(setupTokens).where(eq(setupTokens.tokenHash, tokenHash));
    return NextResponse.json(
      { error: "Email delivery failed. New token deleted. Retry when ready." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
