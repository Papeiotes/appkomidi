"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LiveMap } from "@/components/maps";
import { Shell } from "@/components/shell";
import { api, type Shift } from "@/lib/api";
import { useRequire } from "@/lib/auth";

export default function LivePage() {
  const auth = useRequire("ADMIN");
  const locale = auth.locale;
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    if (!auth.token) return;
    const load = () => api<{ shifts: Shift[] }>("/admin/live", {}, auth.token).then((body) => setShifts(body.shifts));
    void load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [auth.token]);

  const focus = shifts.find((shift) => shift.location) ?? shifts[0];

  return (
    <Shell>
      <h1 className="font-serif text-4xl">{t(locale, "liveTitle")}</h1>
      {shifts.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t(locale, "emptyTrips")}</p> : null}
      {focus ? (
        <div className="mt-4">
          <LiveMap driver={focus.location} line={focus.location ? [[focus.location.lat, focus.location.lng], [focus.destination.lat, focus.destination.lng]] : []} stops={[focus.destination]} />
        </div>
      ) : null}
      <ul className="mt-4 grid gap-2">
        {shifts.map((shift) => (
          <li key={shift.id} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <Link href={`/ride/${shift.id}`}>{shift.businessName} · {shift.title} · {shift.driver?.name ?? t(locale, "unassigned")}</Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
