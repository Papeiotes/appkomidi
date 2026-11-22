"use client";

import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { ChoiceGrid, Wizard, binColor } from "@/components/wizard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;
const brackets = ["KG_0_10", "KG_10_20", "KG_20_50", "KG_50_PLUS"] as const;
type Slot = { at: string; remainingKg: number; bookable: boolean };

export default function BookWizard() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [bracket, setBracket] = useState("");
  const [day, setDay] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [activeBin, setActiveBin] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const needed = bracket === "KG_0_10" ? 10 : bracket === "KG_10_20" ? 20 : bracket === "KG_20_50" ? 50 : 75;
  const timeSteps = picked.length;
  const total = 3 + timeSteps + 1;
  const phase = step === 0 ? "bin" : step === 1 ? "kg" : step === 2 ? "day" : step < 3 + timeSteps ? "time" : "review";
  const binIndex = step - 3;

  useEffect(() => {
    const bin = picked[binIndex];
    if (phase !== "time" || !bin || !token) return;
    api<{ slots: Slot[]; suggested: string | null }>(`/slots?binType=${bin}`, {}, token).then((body) => {
      setSlots(body.slots.filter((slot) => !day || slot.at.slice(0, 10) === day));
      setSuggested(body.suggested);
    });
  }, [phase, binIndex, token, day, picked]);

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
        {phase === "bin" ? (
          <ChoiceGrid multiple value={picked} onChange={(id) => setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} options={bins.map((item) => ({ id: item, label: t(locale, `bin_${item}` as MessageKey), color: binColor[item] }))} />
        ) : null}
        {phase === "kg" ? <ChoiceGrid value={bracket} onChange={setBracket} options={brackets.map((item) => ({ id: item, label: t(locale, `bracket_${item}` as MessageKey) }))} /> : null}
        {phase === "day" ? <ChoiceGrid value={day} onChange={setDay} options={days.map((item) => ({ id: item, label: item }))} /> : null}
        {phase === "time" ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">{t(locale, `bin_${picked[binIndex]}` as MessageKey)}</p>
            {suggested ? <p className="text-primary">{t(locale, "suggested")}</p> : null}
            {slots.filter((slot) => slot.remainingKg >= needed).slice(0, 10).map((slot) => (
              <button key={slot.at} type="button" className={`h-14 rounded-2xl border px-4 text-left ${times[picked[binIndex]] === slot.at ? "border-primary bg-secondary" : "border-border"} ${slot.at === suggested ? "ring-2 ring-primary" : ""}`} onClick={() => setTimes({ ...times, [picked[binIndex]]: slot.at })}>
                {formatWhen(slot.at, locale)} · {slot.remainingKg} kg
              </button>
            ))}
            <p className="text-sm text-muted-foreground">{t(locale, "disclaimer")}</p>
          </div>
        ) : null}
        {phase === "review" ? (
          <ul className="grid gap-2 text-lg">
            {picked.map((bin) => <li key={bin}>{t(locale, `bin_${bin}` as MessageKey)} · {times[bin] ? formatWhen(times[bin], locale) : ""}</li>)}
          </ul>
        ) : null}
      </Wizard>
    </Shell>
  );
}
