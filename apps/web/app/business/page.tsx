"use client";

import { formatWhen, t, type MessageKey } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { binColor } from "@/components/wizard";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Booking = {
  id: string;
  status: string;
  binType: string;
  bracket: string;
  scheduledAt: string;
  arrivalOpen: boolean;
  shift: { id: string; status: string };
};

export default function BusinessHome() {
  const auth = useRequire("BUSINESS");
  const locale = auth.locale;
  const [pending, setPending] = useState(false);
  const [rows, setRows] = useState<Booking[]>([]);

  useEffect(() => {
    if (!auth.token) return;
    api<{ business: { status: string } }>("/business", {}, auth.token).then((body) => {
      setPending(body.business.status !== "APPROVED");
      if (body.business.status === "APPROVED") {
        return api<{ bookings: Booking[] }>("/bookings/mine", {}, auth.token).then((list) => setRows(list.bookings));
      }
    });
  }, [auth.token]);

  const upcoming = rows.filter((row) => row.status === "CONFIRMED");
  const live = upcoming.find((row) => row.shift.status === "IN_PROGRESS" || row.arrivalOpen);

  return (
    <Shell>
      <div className="mx-auto max-w-lg pb-10">
        {pending ? (
          <div className="rounded-3xl bg-secondary p-6">
            <h1 className="text-2xl font-semibold">{t(locale, "pendingTitle")}</h1>
            <p className="mt-2 text-muted-foreground">{t(locale, "pendingBody")}</p>
          </div>
        ) : (
          <Button className="h-16 w-full rounded-2xl text-lg" render={<Link href="/business/book" />}>
            {t(locale, "bookCta")}
          </Button>
        )}
        {live ? (
          <Link href={`/business/live?id=${live.id}`} className="mt-4 block rounded-3xl border border-primary bg-secondary p-5">
            <p className="text-sm text-primary">{t(locale, "onTheWay")}</p>
            <p className="mt-1 text-xl font-semibold">{live.arrivalOpen ? t(locale, "arrivedTitle") : t(locale, "eta")}</p>
          </Link>
        ) : null}
        <h2 className="mt-8 text-sm font-medium tracking-wide text-muted-foreground uppercase">{t(locale, "upcoming")}</h2>
        {upcoming.length === 0 ? <p className="mt-3 text-muted-foreground">{t(locale, "emptyNext")}</p> : null}
        <ul className="mt-3 grid gap-3">
          {upcoming.map((row) => (
            <li key={row.id} className="rounded-3xl border border-border p-5">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: binColor[row.binType] }} />
                <p className="text-lg font-medium">{t(locale, `bin_${row.binType}` as MessageKey)}</p>
              </div>
              <p className="mt-2 text-muted-foreground">{formatWhen(row.scheduledAt, locale)} · {t(locale, `bracket_${row.bracket}` as MessageKey)}</p>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
