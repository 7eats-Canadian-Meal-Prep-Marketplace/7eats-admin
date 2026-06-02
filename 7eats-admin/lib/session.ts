import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getAdminSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    redirect("/login");
  }

  return session;
}

export async function getSessionOrNull() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}
