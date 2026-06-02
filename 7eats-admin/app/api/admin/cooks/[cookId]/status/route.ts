import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { cookProfiles } from "@/db/schema/cooks";
import { auth } from "@/lib/auth";

const schema = z.object({
  status: z.enum(["active", "suspended", "banned"]),
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
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const [cook] = await db
    .select({ userId: cookProfiles.userId })
    .from(cookProfiles)
    .where(eq(cookProfiles.id, cookId))
    .limit(1);

  if (!cook) {
    return NextResponse.json({ error: "Cook not found" }, { status: 404 });
  }

  await db
    .update(authUser)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(authUser.id, cook.userId));

  return NextResponse.json({ ok: true });
}
