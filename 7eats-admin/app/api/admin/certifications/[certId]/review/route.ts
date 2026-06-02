import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cookCertifications } from "@/db/schema/cooks";
import { auth } from "@/lib/auth";

const schema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ certId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { certId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [cert] = await db
    .select()
    .from(cookCertifications)
    .where(eq(cookCertifications.id, certId))
    .limit(1);

  if (!cert) {
    return NextResponse.json(
      { error: "Certification not found" },
      { status: 404 },
    );
  }

  await db
    .update(cookCertifications)
    .set({
      status: parsed.data.status,
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
      reviewNotes: parsed.data.reviewNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(cookCertifications.id, certId));

  return NextResponse.json({ ok: true });
}
