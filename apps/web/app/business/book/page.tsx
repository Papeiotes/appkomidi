"use client";

import { HORIZON_DAYS, athensDateKey, athensDatePlus, formatWhen, t, type MessageKey } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MonthCalendar } from "@/components/month-calendar";
import { ErrorNote, Shell } from "@/components/shell";
import { TimeGrid, type TimeSlot } from "@/components/time-grid";
import { ChoiceGrid, Wizard, binColor } from "@/components/wizard";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;

function kilosOf(value: string) {
  const kilos = Number(value);
  return Number.isInteger(kilos) && kilos >= 1 && kilos <= 2000 ? kilos : 0;
}

export default function BookWizard() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [kgByBin, setKgByBin] = useState<Record<string, string>>({});
  const [lastKg, setLastKg] = useState<Record<string, number>>({});
  const [day, setDay] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    api<{ bookings: { binType: string; kg: number }[] }>("/bookings/mine", {}, token)
      .then((body) => {
        const next: Record<string, number> = {};
        for (const row of body.bookings) if (next[row.binType] == null) next[row.binType] = row.kg;
        setLastKg(next);
      })
      .catch(() => undefined);
  }, [token]);
  useEffect(() => {
    if (!token || picked.length === 0) return;
    const horizon = Array.from({ length: HORIZON_DAYS }, (_, index) => athensDatePlus(index, new Date()));
    Promise.all(picked.map((item) => api<{ slots: TimeSlot[] }>(`/slots?binType=${item}`, {}, token)))
      .then((bodies) => {
        const sets = bodies.map((body) => new Set(body.slots.map((slot) => athensDateKey(new Date(slot.at)))));
        const [first, ...rest] = sets;
        const open = horizon.filter((item) => Boolean(first?.has(item) && rest.every((set) => set.has(item))));
        setDays(open);
        setDay((current) => (open.includes(current) ? current : ""));
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
  }, [token, picked]);
  const total = 2 + picked.length * 2 + 1;
  const afterDay = step - 2;
  const binPair = Math.floor(afterDay / 2);
  const phase = step === 0 ? "bin" : step === 1 ? "day" : binPair >= picked.length ? "review" : afterDay % 2 === 0 ? "kg" : "time";
  const bin = picked[binPair] ?? "";

  useEffect(() => {
    if (phase !== "time" || !bin || !token || !day || !kilosOf(kgByBin[bin] ?? "")) return;
    api<{ slots: TimeSlot[]; suggested: string | null }>(`/slots?binType=${bin}&kg=${kgByBin[bin]}`, {}, token).then((body) => {
      setSlots(body.slots.filter((slot) => athensDateKey(new Date(slot.at)) === day));
      setSuggested(body.suggested && athensDateKey(new Date(body.suggested)) === day ? body.suggested : null);
    });
  }, [phase, bin, token, day, kgByBin]);
  useEffect(() => {
    if (phase !== "kg" || !bin || kgByBin[bin] || !lastKg[bin]) return;
    setKgByBin((current) => ({ ...current, [bin]: String(lastKg[bin]) }));
  }, [phase, bin, lastKg, kgByBin]);

  const title =
    phase === "bin"
      ? t(locale, "pickBin")
      : phase === "day"
        ? t(locale, "pickDay")
        : phase === "kg"
          ? `${t(locale, "pickKg")} · ${t(locale, `bin_${bin}` as MessageKey)}`
          : phase === "time"
            ? `${t(locale, "pickTime")} · ${t(locale, `bin_${bin}` as MessageKey)}`
            : t(locale, "review");

  return (
    <Shell>
      <Wizard
        step={step}
        total={Math.max(total, 1)}
        title={title}
        wide={phase === "time"}
        onBack={step ? () => setStep(step - 1) : undefined}
        canNext={phase === "bin" ? picked.length > 0 : phase === "day" ? Boolean(day) : phase === "kg" ? Boolean(kilosOf(kgByBin[bin] ?? "")) : phase === "time" ? Boolean(times[bin]) : true}
        nextLabel={phase === "review" ? t(locale, "book") : undefined}
        onNext={() => {
          if (phase !== "review") {
            setError(null);
            setStep(step + 1);
            return;
          }
          void api<{ results: { ok: boolean; code?: string }[] }>(
            "/bookings",
            {
              method: "POST",
              body: JSON.stringify({
                items: picked.map((item) => ({ binType: item, kg: kilosOf(kgByBin[item] ?? ""), scheduledAt: times[item] })),
              }),
            },
            token,
          )
            .then((body) => {
              const failed = body.results.find((result) => !result.ok);
              if (failed) {
                setError(failed.code ?? "REQUEST_FAILED");
                return;
              }
              router.push("/business");
            })
            .catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
        }}
      >
        <div key={step} className="step-in">
          <ErrorNote code={error} locale={locale} />
          {phase === "bin" ? (
            <ChoiceGrid
              multiple
              value={picked}
              onChange={(id) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
              options={bins.map((item) => ({ id: item, label: t(locale, `bin_${item}` as MessageKey), color: binColor[item] }))}
            />
          ) : null}
          {phase === "day" ? (
            days.length ? <MonthCalendar days={days} value={day} onChange={setDay} locale={locale} /> : <p className="text-base text-muted-foreground">{t(locale, "noShiftDay")}</p>
          ) : null}
          {phase === "kg" ? (
            <div>
              <p className="text-muted-foreground">{t(locale, "typeKg")}</p>
              {lastKg[bin] ? (
                <button type="button" className="mt-3 inline-flex h-11 items-center rounded-full border border-primary px-4 text-primary" onClick={() => setKgByBin((current) => ({ ...current, [bin]: String(lastKg[bin]) }))}>
                  {t(locale, "lastKg")} · {lastKg[bin]} kg
                </button>
              ) : null}
              <input
                inputMode="numeric"
                className="mt-4 h-16 w-full rounded-2xl border border-border px-4 text-2xl"
                value={kgByBin[bin] ?? ""}
                onChange={(event) => setKgByBin((current) => ({ ...current, [bin]: event.target.value.replace(/[^0-9]/g, "") }))}
              />
            </div>
          ) : null}
          {phase === "time" ? (
            <div>
              {slots.length === 0 ? <p className="text-base text-muted-foreground">{t(locale, "noShiftDay")}</p> : slots.some((slot) => slot.bookable) ? (
                <TimeGrid slots={slots} suggested={suggested} value={times[bin] ?? ""} onChange={(at) => setTimes({ ...times, [bin]: at })} locale={locale} />
              ) : (
                <p className="text-base text-muted-foreground">{t(locale, "noRoom")}</p>
              )}
              <p className="mt-4 text-sm text-muted-foreground">{t(locale, "disclaimer")}</p>
            </div>
          ) : null}
          {phase === "review" ? (
            <ul className="grid gap-3">
              {picked.map((item) => (
                <li key={item} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-3">
                    <span className="h-4 w-4 rounded-full" style={{ background: binColor[item] }} />
                    <p className="text-lg font-medium">{t(locale, `bin_${item}` as MessageKey)}</p>
                  </div>
                  <p className="mt-2">{kgByBin[item]} kg</p>
                  <p className="text-muted-foreground">{times[item] ? formatWhen(times[item], locale) : ""}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Wizard>
    </Shell>
  );
}
