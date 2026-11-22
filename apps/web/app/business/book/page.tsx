"use client";

import { athensDateKey, athensDatePlus, formatWhen, t, type MessageKey } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MonthCalendar } from "@/components/month-calendar";
import { Shell } from "@/components/shell";
import { ChoiceGrid, Wizard, binColor } from "@/components/wizard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;
const brackets = ["KG_0_10", "KG_10_20", "KG_20_50", "KG_50_PLUS"] as const;
type Slot = { at: string; bookable: boolean };

export default function BookWizard() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [bracket, setBracket] = useState("");
  const [day, setDay] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, index) => athensDatePlus(index));
  const timeSteps = picked.length;
  const total = 3 + timeSteps + 1;
  const phase = step === 0 ? "bin" : step === 1 ? "kg" : step === 2 ? "day" : step < 3 + timeSteps ? "time" : "review";
  const binIndex = step - 3;

  useEffect(() => {
    const bin = picked[binIndex];
    if (phase !== "time" || !bin || !token || !day) return;
    api<{ slots: Slot[]; suggested: string | null }>(`/slots?binType=${bin}&bracket=${bracket}`, {}, token).then((body) => {
      setSlots(body.slots.filter((slot) => athensDateKey(new Date(slot.at)) === day));
      setSuggested(body.suggested && athensDateKey(new Date(body.suggested)) === day ? body.suggested : null);
    });
  }, [phase, binIndex, token, day, picked, bracket]);

  const ordered = [...slots].sort((a, b) => {
    if (a.at === suggested) return -1;
    if (b.at === suggested) return 1;
    return a.at.localeCompare(b.at);
  });

  return (
    <Shell>
      <Wizard
        step={step}
        total={Math.max(total, 1)}
        title={phase === "bin" ? t(locale, "pickBin") : phase === "kg" ? t(locale, "statsKg") : phase === "day" ? t(locale, "pickDay") : phase === "time" ? t(locale, "pickTime") : t(locale, "review")}
        onBack={step ? () => setStep(step - 1) : undefined}
        canNext={phase === "bin" ? picked.length > 0 : phase === "kg" ? Boolean(bracket) : phase === "day" ? Boolean(day) : phase === "time" ? Boolean(times[picked[binIndex]]) : true}
        nextLabel={phase === "review" ? t(locale, "book") : undefined}
        onNext={() => {
          if (phase !== "review") setStep(step + 1);
          else {
            void api("/bookings", {
              method: "POST",
              body: JSON.stringify({ items: picked.map((bin) => ({ binType: bin, bracket, scheduledAt: times[bin] })) }),
            }, token).then(() => router.push("/business"));
          }
        }}
      >
        <div key={step} className="step-in min-h-[26rem]">
          {phase === "bin" ? (
            <ChoiceGrid multiple value={picked} onChange={(id) => setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} options={bins.map((item) => ({ id: item, label: t(locale, `bin_${item}` as MessageKey), color: binColor[item] }))} />
          ) : null}
          {phase === "kg" ? <ChoiceGrid value={bracket} onChange={setBracket} options={brackets.map((item) => ({ id: item, label: t(locale, `bracket_${item}` as MessageKey) }))} /> : null}
          {phase === "day" ? <MonthCalendar days={days} value={day} onChange={setDay} locale={locale} /> : null}
          {phase === "time" ? (
            <div>
              <p className="mb-3 text-sm text-muted-foreground">{t(locale, `bin_${picked[binIndex]}` as MessageKey)}</p>
              <div className="max-h-[22rem] overflow-y-auto rounded-2xl border border-border">
                {ordered.length === 0 ? <p className="p-4 text-muted-foreground">{t(locale, "empty")}</p> : null}
                {ordered.map((slot) => {
                  const chosen = times[picked[binIndex]] === slot.at;
                  const hint = slot.at === suggested;
                  return (
                    <button
                      key={slot.at}
                      type="button"
                      disabled={!slot.bookable}
                      className={`flex h-14 w-full items-center justify-between border-b border-border px-4 text-left last:border-b-0 ${hint ? "sticky top-0 z-10 bg-secondary" : "bg-white"} ${chosen ? "ring-2 ring-primary ring-inset" : ""} ${slot.bookable ? "" : "cursor-default text-muted-foreground/50"}`}
                      onClick={() => setTimes({ ...times, [picked[binIndex]]: slot.at })}
                    >
                      <span>{formatWhen(slot.at, locale)}</span>
                      <span className="text-sm text-primary">{hint ? t(locale, "suggested") : slot.bookable ? "" : t(locale, "unavailable")}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t(locale, "disclaimer")}</p>
            </div>
          ) : null}
          {phase === "review" ? (
            <ul className="grid gap-2 text-lg">
              {picked.map((bin) => <li key={bin}>{t(locale, `bin_${bin}` as MessageKey)} · {t(locale, `bracket_${bracket}` as MessageKey)} · {times[bin] ? formatWhen(times[bin], locale) : ""}</li>)}
            </ul>
          ) : null}
        </div>
      </Wizard>
    </Shell>
  );
}
