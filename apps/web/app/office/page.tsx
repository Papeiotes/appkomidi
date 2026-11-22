"use client";

import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { useEffect, useState } from "react";
import { Wizard } from "@/components/wizard";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Row = {
  id: string;
  binType: string;
  kg: number;
  status: string;
  scheduledAt: string;
  business: { name: string };
  shift: { driver: { name: string } };
};

export default function OfficePage() {
  const { locale, token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [bin, setBin] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [step, setStep] = useState(0);
  const [action, setAction] = useState<"move" | "cancel" | "ask" | "">("");
  const [when, setWhen] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const params = bin ? `?binType=${bin}` : "";
    const body = await api<{ bookings: Row[] }>(`/office/bookings${params}`, {}, token);
    setRows(body.bookings);
  }
  useEffect(() => {
    if (token) void load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
  }, [token, bin]);

  if (selected) {
    const titles = [t(locale, "more"), action === "move" ? t(locale, "pickTime") : action === "ask" ? t(locale, "question") : t(locale, "review")];
    const total = action === "cancel" ? 2 : 3;
    return (
      <Wizard
        step={step}
        total={total}
        title={titles[Math.min(step, titles.length - 1)]}
        onBack={() => (step === 0 ? setSelected(null) : setStep(step - 1))}
        nextLabel={step === total - 1 ? t(locale, "save") : undefined}
        canNext={step === 0 ? Boolean(action) : true}
        onNext={() => {
          if (step < total - 1) setStep(step + 1);
          else {
            const done = () => { setSelected(null); return load(); };
            if (action === "cancel") void api(`/office/bookings/${selected.id}/cancel`, { method: "POST" }, token).then(done);
            if (action === "move") void api(`/office/bookings/${selected.id}/move`, { method: "POST", body: JSON.stringify({ scheduledAt: new Date(when).toISOString() }) }, token).then(done);
            if (action === "ask") void api(`/office/bookings/${selected.id}/question`, { method: "POST", body: JSON.stringify({ text }) }, token).then(done);
          }
        }}
      >
        {step === 0 ? (
          <div className="grid gap-3">
            {(["move", "cancel", "ask"] as const).map((item) => (
              <button key={item} type="button" className={`h-14 rounded-2xl border ${action === item ? "border-primary bg-secondary" : "border-border"}`} onClick={() => setAction(item)}>
                {t(locale, item === "move" ? "changeTime" : item === "cancel" ? "cancelBooking" : "question")}
              </button>
            ))}
          </div>
        ) : null}
        {step === 1 && action === "move" ? <Input className="h-14" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /> : null}
        {step === 1 && action === "ask" ? <Input className="h-14" value={text} onChange={(event) => setText(event.target.value)} /> : null}
        {step === total - 1 ? <p className="text-lg">{selected.business.name}</p> : null}
      </Wizard>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(locale, "navBookings")}</h1>
      {error ? <p className="mt-3 text-destructive">{error}</p> : null}
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {["", "GREEN", "BLUE", "YELLOW", "BROWN"].map((item) => (
          <button key={item} type="button" className={`h-11 shrink-0 rounded-full px-4 ${bin === item ? "bg-primary text-white" : "bg-muted"}`} onClick={() => setBin(item)}>
            {item ? t(locale, `bin_${item}` as MessageKey) : t(locale, "filters")}
          </button>
        ))}
      </div>
      <ul className="mt-6 grid gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="min-h-16 w-full rounded-2xl border border-border px-4 py-4 text-left" onClick={() => { setSelected(row); setStep(0); setAction(""); }}>
              <p className="text-lg">{row.business.name}</p>
              <p className="text-sm text-muted-foreground">{formatWhen(row.scheduledAt, locale)} · {row.kg} kg · {row.shift.driver.name}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
