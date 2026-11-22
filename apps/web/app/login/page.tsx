"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, homeFor, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const locale = auth.locale;
  const [email, setEmail] = useState("admin@vardia.gr");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Shell>
      <form
        className="mx-auto grid max-w-md gap-4 rounded-2xl border border-border bg-card p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          try {
            const body = await api<{ token: string; user: User }>("/auth/login", {
              method: "POST",
              body: JSON.stringify({ email, password }),
            });
            auth.login(body.token, body.user);
            router.push(homeFor(body.user.role));
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
          } finally {
            setPending(false);
          }
        }}
      >
        <div>
          <h1 className="font-serif text-4xl">{t(locale, "loginTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(locale, "loginBody")}</p>
        </div>
        <ErrorNote code={error} locale={locale} />
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t(locale, "email")}</Label>
          <Input id="email" className="h-10" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">{t(locale, "password")}</Label>
          <Input id="password" className="h-10" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <Button className="h-10" type="submit" disabled={pending}>
          {pending ? t(locale, "loading") : t(locale, "signIn")}
        </Button>
        <p className="rounded-lg bg-muted px-3 py-2 text-xs">{t(locale, "demoHint")}</p>
        <p className="text-sm">
          {t(locale, "noAccount")}{" "}
          <Link className="underline" href="/register">
            {t(locale, "registerTitle")}
          </Link>
        </p>
      </form>
    </Shell>
  );
}
