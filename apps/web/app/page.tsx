"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { homeFor } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const bins = [
  ["bin_GREEN", "#1b7f4a"],
  ["bin_BLUE", "#2b6cb0"],
  ["bin_YELLOW", "#d6a400"],
  ["bin_BROWN", "#8a5a3b"],
] as const;

export default function HomePage() {
  const auth = useAuth();
  const locale = auth.locale;
  return (
    <Shell>
      <section className="py-8">
        <h1 className="max-w-xl text-4xl font-semibold leading-tight">{t(locale, "heroTitle")}</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">{t(locale, "heroBody")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {auth.user ? (
            <Button className="h-10" render={<Link href={homeFor(auth.user.role)} />}>
              {t(locale, "navBook")}
            </Button>
          ) : (
            <>
              <Button className="h-10" render={<Link href="/register" />}>
                {t(locale, "ctaRegister")}
              </Button>
              <Button variant="outline" className="h-10" render={<Link href="/login" />}>
                {t(locale, "ctaLogin")}
              </Button>
            </>
          )}
        </div>
        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {bins.map(([key, color]) => (
            <li key={key} className="flex items-center gap-3 rounded-xl border border-border px-3 py-3">
              <span className="h-4 w-4 rounded-full" style={{ background: color }} />
              {t(locale, key)}
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
