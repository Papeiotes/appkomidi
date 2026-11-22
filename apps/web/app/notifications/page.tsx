"use client";

import { formatWhen, t } from "@vardia/shared";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Note = {
  id: string;
  type: string;
  titleEl: string;
  titleEn: string;
  bodyEl: string;
  bodyEn: string;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const auth = useRequire();
  const locale = auth.locale;
  const [items, setItems] = useState<Note[]>([]);

  async function load() {
    if (!auth.token) return;
    const body = await api<{ items: Note[] }>("/notifications", {}, auth.token);
    setItems(body.items);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-4xl">{t(locale, "notificationsTitle")}</h1>
        <Button
          variant="outline"
          onClick={async () => {
            await api("/notifications/read-all", { method: "POST" }, auth.token);
            await load();
          }}
        >
          {t(locale, "markAllRead")}
        </Button>
      </div>
      {items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t(locale, "emptyNotifications")}</p> : null}
      <ul className="mt-4 grid gap-2">
        {items.map((item) => (
          <li key={item.id} className={`rounded-xl border border-border px-3 py-3 ${item.readAt ? "bg-card" : "bg-secondary"}`}>
            <p className="font-medium">{locale === "el" ? item.titleEl : item.titleEn}</p>
            <p className="text-sm">{locale === "el" ? item.bodyEl : item.bodyEn}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatWhen(item.createdAt, locale)}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
