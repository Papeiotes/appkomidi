"use client";

import { t, translateError, type Locale } from "@vardia/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, homeFor } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const links: Record<string, { href: string; key: "navOverview" | "navApprovals" | "navLive" | "navBook" | "navMyRides" | "navDrive" }[]> = {
  ADMIN: [
    { href: "/admin", key: "navApprovals" },
    { href: "/admin/live", key: "navLive" },
  ],
  BUSINESS_OWNER: [{ href: "/business", key: "navOverview" }],
  EMPLOYEE: [
    { href: "/ride", key: "navBook" },
    { href: "/ride/mine", key: "navMyRides" },
  ],
  DRIVER: [{ href: "/drive", key: "navDrive" }],
};

export function LanguageToggle({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) {
  return (
    <div className="flex rounded-full bg-muted p-0.5 text-xs">
      {(["el", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          className={`rounded-full px-2.5 py-1 ${locale === item ? "bg-card text-foreground" : "text-muted-foreground"}`}
          onClick={() => onChange(item)}
        >
          {item === "el" ? "ΕΛ" : "EN"}
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const locale = auth.locale;

  useEffect(() => {
    if (!auth.token) return;
    let stop = false;
    const load = () =>
      api<{ unread: number }>("/notifications", {}, auth.token)
        .then((body) => {
          if (!stop) setUnread(body.unread);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 12000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [auth.token, pathname]);

  const nav = auth.user ? links[auth.user.role] : [];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={auth.user ? homeFor(auth.user.role) : "/"} className="font-serif text-2xl leading-none">
            {t(locale, "brand")}
          </Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm ${pathname === item.href ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
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
                  {unread > 0 ? ` (${unread})` : ""}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => router.push("/account")}>
                  {auth.user.name.split(" ")[0]}
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
        {nav.length > 0 ? (
          <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${pathname === item.href ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {t(locale, item.key)}
              </Link>
            ))}
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

export function ErrorNote({ code, locale }: { code: string | null; locale: Locale }) {
  if (!code) return null;
  return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{translateError(locale, code)}</p>;
}
