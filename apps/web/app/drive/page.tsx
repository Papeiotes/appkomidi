"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Capacity, StatusBadge, When } from "@/components/bits";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api, type Shift } from "@/lib/api";
import { useRequire } from "@/lib/auth";

export default function DrivePage() {
  const auth = useRequire("DRIVER");
  const locale = auth.locale;
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    if (!auth.token) return;
    api<{ shifts: Shift[] }>("/driver/shifts", {}, auth.token).then((body) => setShifts(body.shifts));
  }, [auth.token]);

  return (
    <Shell>
      <h1 className="font-serif text-4xl">{t(locale, "navDrive")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(locale, "openWebDriver")}</p>
      {shifts.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t(locale, "emptyShifts")}</p> : null}
      <ul className="mt-4 grid gap-3">
        {shifts.map((shift) => (
          <li key={shift.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{shift.businessName}</p>
                <p>{shift.title}</p>
                <p className="text-sm text-muted-foreground">
                  <When iso={shift.departsAt} locale={locale} />
                </p>
              </div>
              <StatusBadge kind="status" status={shift.status} locale={locale} />
            </div>
            <div className="mt-3">
              <Capacity shift={shift} locale={locale} />
            </div>
            <Button className="mt-3" render={<Link href={`/drive/${shift.id}`} />}>
              {t(locale, "details")}
            </Button>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
