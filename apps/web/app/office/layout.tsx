"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LanguageToggle } from "@/components/shell";
import { useAuth, useRequire } from "@/lib/auth";

export default function OfficeLayout({ children }: { children: ReactNode }) {
  const auth = useRequire();
  const router = useRouter();
  const locale = auth.locale;
  const [open, setOpen] = useState(false);
  function signOut() {
    auth.logout();
    router.push("/");
  }
  if (auth.user && auth.user.role !== "OFFICE" && auth.user.role !== "ADMIN") return null;
  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-[220px_1fr]">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
        <button type="button" aria-label={t(locale, "menu")} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-lg" onClick={() => setOpen(true)}>
          ☰
        </button>
        <p className="text-lg font-semibold text-primary">{t(locale, "roleOffice")}</p>
        <button type="button" className="ml-auto inline-flex h-11 items-center rounded-full border border-border px-4 text-sm" onClick={signOut}>
          {t(locale, "logout")}
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label={t(locale, "menu")} className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white p-4 shadow-xl">
            <p className="text-xl font-semibold text-primary">{t(locale, "roleOffice")}</p>
            <Link href="/office" onClick={() => setOpen(false)} className="mt-4 flex min-h-11 items-center rounded-xl bg-secondary px-3">
              {t(locale, "navBookings")}
            </Link>
            <Link href="/office/approvals" onClick={() => setOpen(false)} className="mt-2 flex min-h-11 items-center rounded-xl px-3">
              {t(locale, "navApprovals")}
            </Link>
            <div className="mt-auto">
              <LanguageToggle locale={locale} onChange={auth.setLocale} />
            </div>
          </aside>
        </div>
      ) : null}
      <aside className="hidden border-r border-border px-4 py-6 md:block md:min-h-screen">
        <p className="px-2 text-xl font-semibold text-primary">{t(locale, "roleOffice")}</p>
        <Link href="/office" className="mt-4 flex min-h-11 items-center rounded-xl bg-secondary px-3">
          {t(locale, "navBookings")}
        </Link>
        <Link href="/office/approvals" className="mt-2 flex min-h-11 items-center rounded-xl px-3">
          {t(locale, "navApprovals")}
        </Link>
        <div className="mt-6">
          <LanguageToggle locale={locale} onChange={auth.setLocale} />
        </div>
      </aside>
      <div className="min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-8">
        <div className="mb-4 hidden justify-end md:flex">
          <button type="button" className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm" onClick={signOut}>
            {t(locale, "logout")}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
