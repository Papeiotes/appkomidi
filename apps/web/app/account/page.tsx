"use client";

import { t } from "@vardia/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorNote, LanguageToggle, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, type User } from "@/lib/api";
import { useRequire } from "@/lib/auth";

export default function AccountPage() {
  const auth = useRequire();
  const locale = auth.locale;
  const [name, setName] = useState(auth.user?.name ?? "");
  const [phone, setPhone] = useState(auth.user?.phone ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return;
    setName(auth.user.name);
    setPhone(auth.user.phone ?? "");
  }, [auth.user]);

  return (
    <Shell>
      <h1 className="font-serif text-4xl">{t(locale, "accountTitle")}</h1>
      <ErrorNote code={error} locale={locale} />
      <form
        className="mt-4 grid max-w-md gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const body = await api<{ user: User }>("/account", { method: "PATCH", body: JSON.stringify({ name, phone }) }, auth.token);
            auth.login(auth.token!, body.user);
            toast.success(t(locale, "saved"));
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
          }
        }}
      >
        <Label>{t(locale, "name")}</Label>
        <Input className="h-10" value={name} onChange={(event) => setName(event.target.value)} />
        <Label>{t(locale, "phone")}</Label>
        <Input className="h-10" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Label>{t(locale, "language")}</Label>
        <LanguageToggle locale={locale} onChange={auth.setLocale} />
        <Button type="submit">{t(locale, "saveProfile")}</Button>
      </form>
      <form
        className="mt-8 grid max-w-md gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api("/account/password", { method: "POST", body: JSON.stringify({ current, next }) }, auth.token);
            setCurrent("");
            setNext("");
            toast.success(t(locale, "saved"));
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
          }
        }}
      >
        <h2 className="font-serif text-2xl">{t(locale, "changePassword")}</h2>
        <Label>{t(locale, "currentPassword")}</Label>
        <Input className="h-10" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
        <Label>{t(locale, "newPassword")}</Label>
        <Input className="h-10" type="password" minLength={8} value={next} onChange={(event) => setNext(event.target.value)} required />
        <Button type="submit" variant="outline">
          {t(locale, "changePassword")}
        </Button>
      </form>
    </Shell>
  );
}
