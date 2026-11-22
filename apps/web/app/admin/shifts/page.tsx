"use client";

import { athensDatePlus, formatWhen, t } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wizard } from "@/components/wizard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Shift = { id: string; startsAt: string; endsAt: string; driver: { name: string }; truck: { plate: string; binType: string } };

export default function ShiftsPage() {
  const { locale, token } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [copyId, setCopyId] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [upcoming, setUpcoming] = useState<string[]>([]);
  useEffect(() => {
    const now = new Date();
    setUpcoming(Array.from({ length: 7 }, (_, index) => athensDatePlus(index + 1, now)));
  }, []);
  useEffect(() => {
    if (token) api<{ shifts: Shift[] }>("/admin/shifts", {}, token).then((body) => setShifts(body.shifts));
  }, [token]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t(locale, "navShifts")}</h1>
        <Link href="/admin/shifts/new" className="inline-flex h-12 min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white">{t(locale, "newShift")}</Link>
      </div>
      <ul className="mt-6 grid gap-3">
        {shifts.map((shift) => (
          <li key={shift.id} className="rounded-2xl border border-border px-4 py-4">
            <p className="text-lg">{shift.driver.name}</p>
            <p className="text-sm text-muted-foreground">{formatWhen(shift.startsAt, locale)} · {shift.truck.plate} · {shift.truck.binType}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="min-h-11" variant="outline" onClick={() => { setCopyId(shift.id); setStep(0); setDates([]); }}>{t(locale, "copyShifts")}</Button>
              <Button className="min-h-11" variant="outline" onClick={() => void api(`/admin/shifts/${shift.id}`, { method: "DELETE" }, token).then(() => setShifts((current) => current.filter((item) => item.id !== shift.id)))}>{t(locale, "deleteShift")}</Button>
            </div>
          </li>
        ))}
      </ul>
      {copyId && step === 0 ? (
        <div className="mt-6 max-w-lg">
          <Wizard step={0} total={2} title={t(locale, "pickDay")} onNext={() => setStep(1)} canNext={dates.length > 0}>
            <div className="grid gap-2">
              {upcoming.map((day) => (
                <button key={day} type="button" className={`h-12 rounded-xl border ${dates.includes(day) ? "border-primary bg-secondary" : "border-border"}`} onClick={() => setDates((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])}>{day}</button>
              ))}
            </div>
          </Wizard>
        </div>
      ) : null}
      {copyId && step === 1 ? (
        <div className="mt-6 max-w-lg">
          <Wizard step={1} total={2} title={t(locale, "review")} onBack={() => setStep(0)} nextLabel={t(locale, "save")} onNext={() => void api("/admin/shifts/copy", { method: "POST", body: JSON.stringify({ shiftId: copyId, dates }) }, token).then(() => { setCopyId(""); return api<{ shifts: Shift[] }>("/admin/shifts", {}, token).then((body) => setShifts(body.shifts)); })}>
            <p>{dates.join(", ")}</p>
          </Wizard>
        </div>
      ) : null}
    </div>
  );
}
