"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/shell";
import { useAuth, useRequire } from "@/lib/auth";

export default function OfficeLayout({ children }: { children: ReactNode }) {
  const auth = useRequire();
  const locale = auth.locale;
  if (auth.user && auth.user.role !== "OFFICE" && auth.user.role !== "ADMIN") return null;
  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-border px-4 py-6 md:min-h-screen md:border-r md:border-b-0">
        <p className="px-2 text-xl font-semibold text-primary">{t(locale, "roleOffice")}</p>
        <Link href="/office" className="mt-4 block rounded-xl bg-secondary px-3 py-3">{t(locale, "navBookings")}</Link>
        <div className="mt-6">
          <LanguageToggle locale={locale} onChange={auth.setLocale} />
        </div>
      </aside>
      <div className="px-5 py-8 md:px-10">{children}</div>
    </div>
  );
}
