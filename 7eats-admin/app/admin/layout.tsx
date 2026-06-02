import { getAdminSession } from "@/lib/session";
import styles from "./admin.module.css";
import { Sidebar } from "./Sidebar";

export const metadata = {
  title: { template: "%s | 7eats Admin", default: "7eats Admin" },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getAdminSession();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
