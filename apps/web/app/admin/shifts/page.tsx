"use client";

import { athensDateKey, athensDatePlus, athensParts, formatWhen, t } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wizard } from "@/components/wizard";
import { ErrorNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Shift = { id: string; startsAt: string; endsAt: string; driver: { name: string }; truck: { plate: string; binType: string } };

export default function ShiftsPage() {
  const { locale, token } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [copyId, setCopyId] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [upcoming, setUpcoming] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("08:00");
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
      <ErrorNote code={error} locale={locale} />
      <ul className="mt-6 grid gap-3">
        {shifts.map((shift) => (
          <li key={shift.id} className="rounded-2xl border border-border px-4 py-4">
            <p className="text-lg">{shift.driver.name}</p>
            <p className="text-sm text-muted-foreground">{formatWhen(shift.startsAt, locale)} · {shift.truck.plate} · {shift.truck.binType}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="min-h-11" variant="outline" onClick={() => { setCopyId(shift.id); setStep(0); setDates([]); }}>{t(locale, "copyShifts")}</Button>
              <Button className="min-h-11" variant="outline" onClick={() => { const when = new Date(shift.startsAt); const parts = athensParts(when); setEditId(shift.id); setEditDate(athensDateKey(when)); setEditTime(`${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`); }}>{t(locale, "editShift")}</Button>
              <Button className="min-h-11" variant="outline" onClick={() => { setError(null); void api(`/admin/shifts/${shift.id}`, { method: "DELETE" }, token).then(() => setShifts((current) => current.filter((item) => item.id !== shift.id))).catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED")); }}>{t(locale, "deleteShift")}</Button>
            </div>
            {editId === shift.id ? (
              <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); setError(null); void api(`/admin/shifts/${shift.id}`, { method: "PATCH", body: JSON.stringify({ date: editDate, time: editTime.slice(0, 5) }) }, token).then(() => api<{ shifts: Shift[] }>("/admin/shifts", {}, token).then((body) => { setShifts(body.shifts); setEditId(""); })).catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED")); }}>
                <Input className="h-12" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} required />
                <Input className="h-12" type="time" step={1800} value={editTime} onChange={(event) => setEditTime(event.target.value)} required />
                <Button className="h-12" type="submit">{t(locale, "save")}</Button>
              </form>
            ) : null}
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
