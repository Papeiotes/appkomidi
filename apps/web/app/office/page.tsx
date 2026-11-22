"use client";

import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { useEffect, useState } from "react";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Row = {
  id: string;
  binType: string;
  kg: number;
  status: string;
  scheduledAt: string;
  business: { name: string; subArea: { name: string } | null };
  shift: { driver: { name: string }; truck: { binType: string } };
};

export default function OfficePage() {
  const auth = useRequire();
  const locale = auth.locale;
  const [rows, setRows] = useState<Row[]>([]);
  const [day, setDay] = useState("");
  const [binType, setBinType] = useState("");
  const [question, setQuestion] = useState<Record<string, string>>({});
  const [moveAt, setMoveAt] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!auth.token) return;
    const params = new URLSearchParams();
    if (day) params.set("day", day);
    if (binType) params.set("binType", binType);
    const body = await api<{ bookings: Row[] }>(`/office/bookings?${params}`, {}, auth.token);
    setRows(body.bookings);
  }

  useEffect(() => {
    if (!auth.token || (auth.user && auth.user.role === "BUSINESS")) return;
    load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
  }, [auth.token, day, binType]);

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{t(locale, "navOffice")}</h1>
      <ErrorNote code={error} locale={locale} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Input className="h-10 w-44" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
        <select className="h-10 rounded-lg border border-input px-2" value={binType} onChange={(event) => setBinType(event.target.value)}>
          <option value="">{t(locale, "filters")}</option>
          {["GREEN", "BLUE", "YELLOW", "BROWN"].map((item) => (
            <option key={item} value={item}>
              {t(locale, `bin_${item}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t(locale, "empty")}</p> : null}
      <ul className="mt-4 grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="grid gap-2 rounded-xl border border-border p-3 text-sm">
            <p>
              {row.business.name} · {t(locale, `bin_${row.binType}` as MessageKey)} · {row.kg} kg · {formatWhen(row.scheduledAt, locale)} · {row.shift.driver.name}
            </p>
            <div className="flex flex-wrap gap-2">
              <Input className="h-10 w-56" type="datetime-local" value={moveAt[row.id] ?? ""} onChange={(event) => setMoveAt({ ...moveAt, [row.id]: event.target.value })} />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await api(`/office/bookings/${row.id}/move`, { method: "POST", body: JSON.stringify({ scheduledAt: new Date(moveAt[row.id]).toISOString() }) }, auth.token);
                    await load();
                  } catch (caught) {
                    setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
                  }
                }}
              >
                {t(locale, "changeTime")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api(`/office/bookings/${row.id}/cancel`, { method: "POST" }, auth.token);
                  await load();
                }}
              >
                {t(locale, "cancelBooking")}
              </Button>
            </div>
            <div className="flex gap-2">
              <Input className="h-10" value={question[row.id] ?? ""} placeholder={t(locale, "question")} onChange={(event) => setQuestion({ ...question, [row.id]: event.target.value })} />
              <Button
                size="sm"
                onClick={async () => {
                  await api(`/office/bookings/${row.id}/question`, { method: "POST", body: JSON.stringify({ text: question[row.id] ?? "" }) }, auth.token);
                  setQuestion({ ...question, [row.id]: "" });
                }}
              >
                {t(locale, "send")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
