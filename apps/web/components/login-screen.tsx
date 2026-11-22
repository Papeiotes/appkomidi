"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { ErrorNote, LanguageToggle } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, homeFor, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();
  const locale = auth.locale;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.ready && auth.user) router.replace(homeFor(auth.user.role));
  }, [auth.ready, auth.user, router]);

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:grid lg:grid-cols-2">
      <section className="relative h-44 sm:h-56 lg:h-auto">
        <img src="/athens.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#1b7f4a]/55" />
        <div className="relative flex h-full flex-col justify-end p-4 text-white lg:justify-between lg:p-12">
          <Logo className="[&_span]:text-white [&_span]:text-2xl lg:[&_span]:text-4xl" />
          <div className="mt-3 lg:mt-0">
            <p className="hidden max-w-md text-2xl font-medium leading-snug lg:block">{t(locale, "loginSubtitle")}</p>
            <p className="mt-2 text-[11px] leading-4 text-white/85">{t(locale, "photoCredit")}</p>
          </div>
        </div>
      </section>
      <section className="flex flex-1 flex-col">
        <div className="flex justify-end px-5 py-4">
          <LanguageToggle locale={locale} onChange={auth.setLocale} />
        </div>
        <main className="flex flex-1 items-center justify-center px-5 pb-12">
          <form
            className="grid w-full max-w-sm gap-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              try {
                const body = await api<{ token: string; user: User }>("/auth/login", {
                  method: "POST",
                  body: JSON.stringify({ username, password }),
                });
                auth.login(body.token, body.user);
                router.push(homeFor(body.user.role));
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
              }
            }}
          >
            <div className="lg:hidden">
              <p className="text-sm font-medium tracking-wide text-primary">{t(locale, "cityBrand")}</p>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium tracking-wide text-primary">{t(locale, "cityBrand")}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t(locale, "loginTitle")}</h1>
            </div>
            <ErrorNote code={error} locale={locale} />
            <div className="grid gap-2">
              <Label htmlFor="username">{t(locale, "username")}</Label>
              <Input id="username" className="h-12" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t(locale, "password")}</Label>
              <Input id="password" className="h-12" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <Button className="h-12 w-full text-base" type="submit">
              {t(locale, "signIn")}
            </Button>
            <Link href="/register" className="inline-flex min-h-11 items-center justify-center text-sm text-primary underline-offset-4 hover:underline">
              {t(locale, "ctaRegister")}
            </Link>
          </form>
        </main>
      </section>
    </div>
  );
}
