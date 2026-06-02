import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cookApplications } from "@/db/schema/applications";
import { auth } from "@/lib/auth";
import { sendMail } from "@/lib/email";

const schema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
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

  if (application.status !== "pending_review") {
    return NextResponse.json(
      { error: "Application is not pending review" },
      { status: 409 },
    );
  }

  await db
    .update(cookApplications)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(cookApplications.id, id));

  await sendMail({
    to: application.contactEmail,
    subject: "Your 7eats application",
    text: [
      `Hi ${application.contactFirstName},`,
      "",
      "Thank you for your interest in joining 7eats as a cook.",
      "",
      "After reviewing your application, we are unable to approve it at this time.",
      "",
      `Reason: ${parsed.data.reason}`,
      "",
      "If you believe this decision was made in error or have additional information to share, please contact us.",
      "",
      "— The 7eats team",
    ].join("\n"),
  });

  return NextResponse.json({ ok: true });
}
