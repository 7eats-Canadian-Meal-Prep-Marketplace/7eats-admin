export const dynamic = "force-dynamic";

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { authUser } from "@/db/schema/auth";
import { UsersClient } from "./UsersClient";

export const metadata = { title: "User Management" };

export default async function UsersPage() {
  const users = await db
    .select()
    .from(authUser)
    .orderBy(desc(authUser.createdAt));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage all platform user accounts</p>
        </div>
      </div>
      <UsersClient users={users} />
    </div>
  );
}
