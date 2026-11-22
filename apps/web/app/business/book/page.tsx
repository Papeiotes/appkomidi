"use client";

import { athensDateKey, athensDatePlus, formatWhen, t, type MessageKey } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MonthCalendar } from "@/components/month-calendar";
import { Shell } from "@/components/shell";
import { TimeGrid, type TimeSlot } from "@/components/time-grid";
import { ChoiceGrid, Wizard, binColor } from "@/components/wizard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;
const brackets = ["KG_0_10", "KG_10_20", "KG_20_50", "KG_50_PLUS"] as const;

export default function BookWizard() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [bracketsByBin, setBracketsByBin] = useState<Record<string, string>>({});
  const [day, setDay] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  useEffect(() => {
    const now = new Date();
    setDays(Array.from({ length: 7 }, (_, index) => athensDatePlus(index, now)));
  }, []);
  const total = 2 + picked.length * 2 + 1;
  const afterDay = step - 2;
  const binPair = Math.floor(afterDay / 2);
  const phase = step === 0 ? "bin" : step === 1 ? "day" : binPair >= picked.length ? "review" : afterDay % 2 === 0 ? "kg" : "time";
  const bin = picked[binPair] ?? "";

  useEffect(() => {
    if (phase !== "time" || !bin || !token || !day || !bracketsByBin[bin]) return;
    api<{ slots: TimeSlot[]; suggested: string | null }>(`/slots?binType=${bin}&bracket=${bracketsByBin[bin]}`, {}, token).then((body) => {
      setSlots(body.slots.filter((slot) => athensDateKey(new Date(slot.at)) === day));
      setSuggested(body.suggested && athensDateKey(new Date(body.suggested)) === day ? body.suggested : null);
    });
  }, [phase, bin, token, day, bracketsByBin]);

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
        canNext={phase === "bin" ? picked.length > 0 : phase === "day" ? Boolean(day) : phase === "kg" ? Boolean(bracketsByBin[bin]) : phase === "time" ? Boolean(times[bin]) : true}
        nextLabel={phase === "review" ? t(locale, "book") : undefined}
        onNext={() => {
          if (phase !== "review") setStep(step + 1);
          else {
            void api(
              "/bookings",
              {
                method: "POST",
                body: JSON.stringify({
                  items: picked.map((item) => ({ binType: item, bracket: bracketsByBin[item], scheduledAt: times[item] })),
                }),
              },
              token,
            ).then(() => router.push("/business"));
          }
        }}
      >
        <div key={step} className="step-in">
          {phase === "bin" ? (
            <ChoiceGrid
              multiple
              value={picked}
              onChange={(id) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
              options={bins.map((item) => ({ id: item, label: t(locale, `bin_${item}` as MessageKey), color: binColor[item] }))}
            />
          ) : null}
          {phase === "day" ? <MonthCalendar days={days} value={day} onChange={setDay} locale={locale} /> : null}
          {phase === "kg" ? (
            <ChoiceGrid
              value={bracketsByBin[bin] ?? ""}
              onChange={(id) => setBracketsByBin((current) => ({ ...current, [bin]: id }))}
              options={brackets.map((item) => ({ id: item, label: t(locale, `bracket_${item}` as MessageKey) }))}
            />
          ) : null}
          {phase === "time" ? (
            <div>
              <TimeGrid slots={slots} suggested={suggested} value={times[bin] ?? ""} onChange={(at) => setTimes({ ...times, [bin]: at })} locale={locale} />
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
                  <p className="mt-2">{t(locale, `bracket_${bracketsByBin[item]}` as MessageKey)}</p>
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
