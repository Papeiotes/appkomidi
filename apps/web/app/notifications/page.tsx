"use client";

import { formatWhen, t } from "@vardia/shared";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Note = {
  id: string;
  type: string;
  titleEl: string;
  titleEn: string;
  bodyEl: string;
  bodyEn: string;
  reply: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const auth = useRequire();
  const locale = auth.locale;
  const [items, setItems] = useState<Note[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function load() {
    if (!auth.token) return;
    const body = await api<{ items: Note[] }>("/notifications", {}, auth.token);
    setItems(body.items);
  }

  useEffect(() => {
    void load();
  }, [auth.token]);

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{t(locale, "navNotifications")}</h1>
      {items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t(locale, "empty")}</p> : null}
      <ul className="mt-4 grid gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border p-3">
            <p className="font-medium">{locale === "el" ? item.titleEl : item.titleEn}</p>
            <p className="text-sm">{locale === "el" ? item.bodyEl : item.bodyEn}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatWhen(item.createdAt, locale)}</p>
            {item.reply ? <p className="mt-2 text-sm">{t(locale, "reply")}: {item.reply}</p> : null}
            {item.type === "OFFICE_QUESTION" && !item.reply && auth.user?.role === "BUSINESS" ? (
              <form
                className="mt-2 flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await api(`/notifications/${item.id}/reply`, { method: "POST", body: JSON.stringify({ reply: draft[item.id] ?? "" }) }, auth.token);
                  await load();
                }}
              >
                <Input className="h-10" value={draft[item.id] ?? ""} onChange={(event) => setDraft({ ...draft, [item.id]: event.target.value })} />
                <Button type="submit">{t(locale, "reply")}</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
