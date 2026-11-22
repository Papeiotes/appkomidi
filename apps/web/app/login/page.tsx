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
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Shell>
      <form
        className="mx-auto grid max-w-md gap-4 rounded-2xl border border-border p-6"
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
        <h1 className="text-3xl font-semibold">{t(locale, "loginTitle")}</h1>
        <ErrorNote code={error} locale={locale} />
        <Label>{t(locale, "username")}</Label>
        <Input className="h-10" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <Label>{t(locale, "password")}</Label>
        <Input className="h-10" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <Button className="h-10" type="submit">
          {t(locale, "signIn")}
        </Button>
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs">{t(locale, "demoHint")}</p>
        <Link className="text-sm text-primary" href="/register">
          {t(locale, "ctaRegister")}
        </Link>
      </form>
    </Shell>
  );
}
