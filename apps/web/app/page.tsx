"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/api";

export default function HomePage() {
  const auth = useAuth();
  const locale = auth.locale;
  const steps = [
    ["step1Title", "step1Body"],
    ["step2Title", "step2Body"],
    ["step3Title", "step3Body"],
  ] as const;

  return (
    <Shell>
      <section className="grid items-end gap-10 py-6 md:grid-cols-[1.2fr_.8fr] md:py-12">
        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">{t(locale, "tagline")}</p>
          <h1 className="mt-3 max-w-xl font-serif text-5xl leading-tight md:text-6xl">{t(locale, "heroTitle")}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t(locale, "heroBody")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {auth.user ? (
              <Button className="h-10 px-4" render={<Link href={homeFor(auth.user.role)} />}>
                {t(locale, "navOverview")}
              </Button>
            ) : (
              <>
                <Button className="h-10 px-4" render={<Link href="/register" />}>
                  {t(locale, "ctaRegisterBusiness")}
                </Button>
                <Button variant="outline" className="h-10 px-4" render={<Link href="/login" />}>
                  {t(locale, "ctaLogin")}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Πρωινή · 07:00</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs">50 μ.</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 bg-primary" />
          </div>
          <ol className="mt-5 grid gap-3 text-sm">
            <li className="flex justify-between">
              <span>Κυψέλη</span>
              <span className="text-muted-foreground">παραλαβή</span>
            </li>
            <li className="flex justify-between">
              <span>Έδρα</span>
              <span className="text-muted-foreground">6/8 θέσεις</span>
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">{t(locale, "mapsNote")}</p>
        </div>
      </section>
      <section className="mt-4">
        <h2 className="font-serif text-3xl">{t(locale, "howTitle")}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {steps.map(([title, body], index) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-5">
              <p className="font-serif text-3xl text-accent">0{index + 1}</p>
              <h3 className="mt-2 font-medium">{t(locale, title)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(locale, body)}</p>
            </article>
          ))}
        </div>
      </section>
      <p className="mt-10 text-sm text-muted-foreground">{t(locale, "footer")}</p>
    </Shell>
  );
}
