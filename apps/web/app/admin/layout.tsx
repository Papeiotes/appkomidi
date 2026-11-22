"use client";

import { t, type MessageKey } from "@vardia/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
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

function NavLinks({ path, onPick }: { path: string; onPick?: () => void }) {
  const { locale } = useAuth();
  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const active = path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onPick}
            className={`flex min-h-11 items-center rounded-xl px-3 text-base ${active ? "bg-secondary font-medium text-primary" : "text-foreground"}`}
          >
            {t(locale, item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const auth = useRequire("ADMIN");
  const path = usePathname();
  const locale = auth.locale;
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-[240px_1fr]">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
        <button type="button" aria-label={t(locale, "menu")} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-lg" onClick={() => setOpen(true)}>
          ☰
        </button>
        <Logo />
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label={t(locale, "menu")} className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <NavLinks path={path} onPick={() => setOpen(false)} />
            <div className="mt-auto pt-6">
              <LanguageToggle locale={locale} onChange={auth.setLocale} />
              <button type="button" className="mt-3 inline-flex h-11 items-center text-base text-muted-foreground" onClick={() => auth.logout()}>
                {t(locale, "logout")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
      <aside className="hidden border-r border-border md:flex md:min-h-screen md:flex-col">
        <div className="px-5 py-6"><Logo /></div>
        <div className="px-3">
          <NavLinks path={path} />
        </div>
        <div className="mt-auto px-5 py-6">
          <LanguageToggle locale={locale} onChange={auth.setLocale} />
          <button type="button" className="mt-4 inline-flex h-11 items-center text-sm text-muted-foreground" onClick={() => auth.logout()}>
            {t(locale, "logout")}
          </button>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-8">{children}</div>
    </div>
  );
}
