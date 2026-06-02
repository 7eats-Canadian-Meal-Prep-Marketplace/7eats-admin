export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export default async function LoginPage() {
  const session = await getSessionOrNull();
  if (session?.user && (session.user as { role?: string }).role === "admin") {
    redirect("/admin");
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>7</span>
          <span className={styles.logoText}>eats</span>
          <span className={styles.logoSub}>Admin</span>
        </div>
        <h1 className={styles.heading}>Sign in to Admin</h1>
        <p className={styles.sub}>
          Internal access only. Admin credentials required.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
