"use client";

import { t } from "@vardia/shared";
import { LanguageToggle, Shell } from "@/components/shell";
import { useRequire } from "@/lib/auth";

export default function AccountPage() {
  const auth = useRequire();
  const locale = auth.locale;
  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{auth.user?.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{auth.user?.username}</p>
      <div className="mt-4">
        <LanguageToggle locale={locale} onChange={auth.setLocale} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{t(locale, "language")}</p>
    </Shell>
  );
}
