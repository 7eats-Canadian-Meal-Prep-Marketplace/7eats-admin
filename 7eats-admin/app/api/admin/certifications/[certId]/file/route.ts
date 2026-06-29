import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cookCertifications } from "@/db/schema/cooks";
import { auth } from "@/lib/auth";
import { getSignedCertUrl } from "@/lib/storage/certs";

// Cert files are stored as private R2 object keys. Resolve the key to a
// short-lived signed URL and redirect the admin's browser to it.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ certId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { certId } = await params;

  const [cert] = await db
    .select({ fileUrl: cookCertifications.fileUrl })
    .from(cookCertifications)
    .where(eq(cookCertifications.id, certId))
    .limit(1);

  if (!cert) {
    return NextResponse.json(
      { error: "Certification not found" },
      { status: 404 },
    );
  }
  if (!cert.fileUrl) {
    return NextResponse.json(
      { error: "No file attached to this certification" },
      { status: 404 },
    );
  }

  let signedUrl: string;
  try {
    signedUrl = await getSignedCertUrl(cert.fileUrl);
  } catch (err) {
    console.error("[cert-file] failed to sign URL:", err);
    return NextResponse.json(
      { error: "Could not generate a link for this file." },
      { status: 502 },
    );
  }

  // Don't let the browser cache the redirect — the signed URL expires.
  const res = NextResponse.redirect(signedUrl);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
