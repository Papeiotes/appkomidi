"use client";

import { t, translateError, type Locale, type MessageKey } from "@vardia/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { homeFor, type Role } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const links: Record<Role, { href: string; key: MessageKey }[]> = {
  ADMIN: [
    { href: "/admin", key: "navAdmin" },
    { href: "/office", key: "navOffice" },
  ],
  OFFICE: [{ href: "/office", key: "navOffice" }],
  BUSINESS: [{ href: "/business", key: "navBook" }],
  DRIVER: [{ href: "/drive", key: "navDrive" }],
};

export function LanguageToggle({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) {
  return (
    <div className="flex rounded-full border border-border p-0.5 text-xs">
      {(["el", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 ${locale === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          onClick={() => onChange(item)}
        >
          {item === "el" ? "ΕΛ" : "EN"}
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const locale = auth.locale;
  const nav = auth.user ? links[auth.user.role] : [];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2">
          <Link href={auth.user ? homeFor(auth.user.role) : "/"} className="inline-flex h-11 items-center">
            <Logo />
          </Link>
          <nav className="hidden gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-11 items-center rounded-full px-3 text-sm ${pathname === item.href ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {t(locale, item.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle locale={locale} onChange={auth.setLocale} />
            {auth.user ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => router.push("/notifications")}>
                  {t(locale, "navNotifications")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    auth.logout();
                    router.push("/");
                  }}
                >
                  {t(locale, "logout")}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => router.push("/login")}>
                {t(locale, "ctaLogin")}
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

export function ErrorNote({ code, locale }: { code: string | null; locale: Locale }) {
  if (!code) return null;
  return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{translateError(locale, code)}</p>;
}
