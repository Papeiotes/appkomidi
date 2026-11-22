"use client";

import { t, type MessageKey } from "@vardia/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/shell";
import { useAuth, useRequire } from "@/lib/auth";

const items: { href: string; key: MessageKey }[] = [
  { href: "/admin", key: "navHome" },
  { href: "/admin/accounts", key: "navAccounts" },
  { href: "/admin/approvals", key: "navApprovals" },
  { href: "/admin/trucks", key: "navTrucks" },
  { href: "/admin/shifts", key: "navShifts" },
  { href: "/admin/bookings", key: "navBookings" },
  { href: "/admin/areas", key: "navAreas" },
  { href: "/admin/stats", key: "navStats" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const auth = useRequire("ADMIN");
  const path = usePathname();
  const locale = auth.locale;
  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-border md:min-h-screen md:border-r md:border-b-0">
        <div className="px-5 py-6 text-xl font-semibold text-primary">{t(locale, "brand")}</div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:px-3">
          {items.map((item) => {
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block shrink-0 rounded-xl px-3 py-3 text-sm ${active ? "bg-secondary font-medium text-primary" : "text-foreground"}`}
              >
                {t(locale, item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-5 py-6 md:block">
          <LanguageToggle locale={locale} onChange={auth.setLocale} />
          <button type="button" className="mt-4 text-sm text-muted-foreground" onClick={() => auth.logout()}>
            {t(locale, "logout")}
          </button>
        </div>
      </aside>
      <div className="px-5 py-8 md:px-10">{children}</div>
    </div>
  );
}
