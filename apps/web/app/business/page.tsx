"use client";

import { athensDateKey, formatWhen, t, type MessageKey } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { binColor } from "@/components/wizard";
import { Shell } from "@/components/shell";
import { api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Booking = {
  id: string;
  status: string;
  binType: string;
  kg: number;
  cancelReason: string | null;
  scheduledAt: string;
  arrivalOpen: boolean;
  shift: { id: string; status: string };
};

function statusLabel(locale: "el" | "en", row: Booking) {
  if (row.cancelReason === "expired") return t(locale, "expired");
  return t(locale, `status_${row.status}` as MessageKey);
}

export default function BusinessHome() {
  const auth = useRequire("BUSINESS");
  const locale = auth.locale;
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [rows, setRows] = useState<Booking[]>([]);
  const [today, setToday] = useState("");

  useEffect(() => {
    if (!auth.token) return;
    api<{ business: { status: string } }>("/business", {}, auth.token).then((body) => {
      setPending(body.business.status !== "APPROVED");
      if (body.business.status === "APPROVED") {
        return api<{ bookings: Booking[] }>("/bookings/mine", {}, auth.token).then((list) => setRows(list.bookings));
      }
    });
  }, [auth.token]);

  useEffect(() => {
    setToday(athensDateKey(new Date()));
  }, []);

  const upcoming = rows.filter((row) => row.status === "CONFIRMED");
  const history = rows.filter((row) => row.status !== "CONFIRMED");
  const shown = tab === "history" ? history : upcoming;
  const live = upcoming.find((row) => athensDateKey(new Date(row.scheduledAt)) === today && (row.shift.status === "IN_PROGRESS" || row.shift.status === "PAUSED"));

  return (
    <Shell>
      <div className="mx-auto max-w-lg pb-10">
        {pending ? (
          <div className="rounded-3xl bg-secondary p-6">
            <h1 className="text-2xl font-semibold">{t(locale, "pendingTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t(locale, "pendingBody")}</p>
          </div>
        ) : (
          <Link href="/business/book" className="inline-flex h-16 min-h-11 w-full items-center justify-center rounded-2xl bg-primary text-lg font-medium text-white">
            {t(locale, "bookCta")}
          </Link>
        )}
        {live ? (
          <Link href={`/business/live?id=${live.id}`} className="mt-4 block rounded-3xl border border-primary bg-secondary p-5">
            <p className="text-sm text-primary">{t(locale, "onTheWay")}</p>
            <p className="mt-1 text-xl font-semibold">{live.arrivalOpen ? t(locale, "arrivedTitle") : t(locale, "eta")}</p>
          </Link>
        ) : null}
        <div className="mt-8 flex gap-2">
          {(["upcoming", "history"] as const).map((item) => (
            <button key={item} type="button" className={`inline-flex h-11 items-center rounded-full px-4 text-sm ${tab === item ? "bg-primary text-white" : "border border-border"}`} onClick={() => setTab(item)}>
              {t(locale, item)}
            </button>
          ))}
        </div>
        {shown.length === 0 ? <p className="mt-3 text-muted-foreground">{t(locale, "emptyNext")}</p> : null}
        <ul className="mt-3 grid gap-3">
          {shown.map((row) => (
            <li key={row.id} className="rounded-3xl border border-border p-5">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: binColor[row.binType] }} />
                <p className="text-lg font-medium">{t(locale, `bin_${row.binType}` as MessageKey)}</p>
              </div>
              <p className="mt-2 text-muted-foreground">{formatWhen(row.scheduledAt, locale)} · {row.kg} kg</p>
              {tab === "history" ? <p className="mt-1 text-sm">{statusLabel(locale, row)}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
