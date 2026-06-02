import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cookApplications } from "@/db/schema/applications";
import { auth } from "@/lib/auth";

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

  if (application.status !== "pending_review") {
    return NextResponse.json(
      { error: "Application is not pending review" },
      { status: 409 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL not configured" },
      { status: 500 },
    );
  }

  const res = await fetch(`${appUrl}/api/internal/issue-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY ?? "",
    },
    body: JSON.stringify({ applicationId: id }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    return NextResponse.json(
      { error: `Failed to issue link: ${text}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
