"use client";

import { t } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChoiceGrid, Wizard } from "@/components/wizard";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function NewShiftPage() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("08:00");
  const [truckId, setTruckId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [trucks, setTrucks] = useState<{ id: string; plate: string; binType: string }[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string; role: string }[]>([]);
  useEffect(() => {
    if (!token) return;
    api<{ trucks: typeof trucks }>("/admin/trucks", {}, token).then((body) => setTrucks(body.trucks));
    api<{ users: typeof drivers }>("/admin/users", {}, token).then((body) => setDrivers(body.users.filter((user) => user.role === "DRIVER")));
  }, [token]);
  const titles = [t(locale, "pickDay"), t(locale, "pickTime"), t(locale, "truck"), t(locale, "driver"), t(locale, "review")];
  return (
    <Wizard
      step={step}
      total={5}
      title={titles[step]}
      onBack={step ? () => setStep(step - 1) : undefined}
      canNext={step === 0 ? Boolean(date) : step === 2 ? Boolean(truckId) : step === 3 ? Boolean(driverId) : true}
      nextLabel={step === 4 ? t(locale, "save") : undefined}
      onNext={() => {
        if (step < 4) setStep(step + 1);
        else {
          const startsAt = new Date(`${date}T${time}`).toISOString();
          void api("/admin/shifts", { method: "POST", body: JSON.stringify({ truckId, driverId, startsAt }) }, token).then(() => router.push("/admin/shifts"));
        }
      }}
    >
      {step === 0 ? <Input className="h-14" type="date" value={date} onChange={(event) => setDate(event.target.value)} /> : null}
      {step === 1 ? <Input className="h-14" type="time" value={time} onChange={(event) => setTime(event.target.value)} /> : null}
      {step === 2 ? <ChoiceGrid value={truckId} onChange={setTruckId} options={trucks.map((truck) => ({ id: truck.id, label: `${truck.plate} · ${truck.binType}` }))} /> : null}
      {step === 3 ? <ChoiceGrid value={driverId} onChange={setDriverId} options={drivers.map((driver) => ({ id: driver.id, label: driver.name }))} /> : null}
      {step === 4 ? <p className="text-lg">{date} {time}</p> : null}
    </Wizard>
  );
}
