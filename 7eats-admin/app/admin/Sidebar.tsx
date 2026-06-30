"use client";
import {
  BarChart2,
  ChefHat,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tag,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./admin.module.css";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/applications", label: "Applications", icon: FileText },
  { href: "/admin/cooks", label: "Cooks", icon: ChefHat },
  { href: "/admin/certifications", label: "Certifications", icon: ShieldCheck },
  { href: "/admin/dishes", label: "Dishes", icon: UtensilsCrossed },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/discounts", label: "Discounts", icon: Tag },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <Link href="/admin" className={styles.brand}>
          <span className={styles.brandMark}>7</span>
          <span className={styles.brandText}>eats</span>
          <span className={styles.brandSub}>Admin</span>
        </Link>
      </div>

      <nav className={styles.nav} aria-label="Admin navigation">
        <ul className={styles.navList}>
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
            <li key={href}>
              <Link
                href={href}
                className={`${styles.navLink} ${isActive(href, exact) ? styles.navLinkActive : ""}`}
                aria-current={isActive(href, exact) ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={2} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <button
          type="button"
          className={styles.signOutBtn}
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut size={16} strokeWidth={2} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
