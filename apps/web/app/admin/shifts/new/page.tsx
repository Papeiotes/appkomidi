"use client";

import { t, type MessageKey } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorNote } from "@/components/shell";
import { ChoiceGrid, Wizard } from "@/components/wizard";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const weeks = [1, 2, 4];

export default function NewShiftPage() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("08:00");
  const [truckId, setTruckId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [repeat, setRepeat] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [trucks, setTrucks] = useState<{ id: string; plate: string; binType: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string; role: string }[]>([]);
  useEffect(() => {
    if (!token) return;
    api<{ trucks: typeof trucks }>("/admin/trucks", {}, token).then((body) => setTrucks(body.trucks));
    api<{ users: typeof drivers }>("/admin/users", {}, token).then((body) => setDrivers(body.users.filter((user) => user.role === "DRIVER")));
  }, [token]);
  const titles = [t(locale, "pickDay"), t(locale, "pickTime"), t(locale, "truck"), t(locale, "driver"), t(locale, "repeatWeekly"), t(locale, "review")];
  return (
    <Wizard
      step={step}
      total={titles.length}
      title={titles[step]}
      onBack={step ? () => setStep(step - 1) : undefined}
      canNext={step === 0 ? Boolean(date) : step === 2 ? Boolean(truckId) : step === 3 ? Boolean(driverId) : true}
      nextLabel={step === 5 ? t(locale, "save") : undefined}
      onNext={() => {
        if (step < 5) setStep(step + 1);
        else {
          setError(null);
          void api("/admin/shifts", { method: "POST", body: JSON.stringify({ truckId, driverId, date, time: time.slice(0, 5), weeks: Number(repeat) }) }, token)
            .then(() => router.push("/admin/shifts"))
            .catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
        }
      }}
    >
      {step === 0 ? <Input className="h-14 text-lg" type="date" value={date} onChange={(event) => setDate(event.target.value)} /> : null}
      {step === 1 ? <Input className="h-14 text-lg" type="time" step={1800} value={time} onChange={(event) => setTime(event.target.value)} /> : null}
      {step === 2 ? <ChoiceGrid value={truckId} onChange={setTruckId} options={trucks.map((truck) => ({ id: truck.id, label: `${truck.plate} · ${t(locale, `bin_${truck.binType}` as MessageKey)}` }))} /> : null}
      {step === 3 ? <ChoiceGrid value={driverId} onChange={setDriverId} options={drivers.map((driver) => ({ id: driver.id, label: driver.name }))} /> : null}
      {step === 4 ? <ChoiceGrid value={repeat} onChange={setRepeat} options={weeks.map((count) => ({ id: String(count), label: String(count) }))} /> : null}
      {step === 5 ? (
        <div className="grid gap-2">
          <p className="text-lg">{date} {time.slice(0, 5)} · ×{repeat}</p>
          <p className="text-sm text-muted-foreground">{t(locale, "horizonHint")}</p>
          <ErrorNote code={error} locale={locale} />
        </div>
      ) : null}
    </Wizard>
  );
}
