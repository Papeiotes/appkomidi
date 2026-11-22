"use client";

import { t, type MessageKey } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChoiceGrid, Wizard, binColor } from "@/components/wizard";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;

export default function NewTruckPage() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [bin, setBin] = useState("");
  const [plate, setPlate] = useState("");
  const [kg, setKg] = useState("800");
  const titles = [t(locale, "pickBin"), t(locale, "plate"), t(locale, "capacityKg"), t(locale, "review")];
  return (
    <Wizard
      step={step}
      total={4}
      title={titles[step]}
      onBack={step ? () => setStep(step - 1) : undefined}
      nextLabel={step === 3 ? t(locale, "save") : undefined}
      canNext={step === 0 ? Boolean(bin) : step === 1 ? plate.length > 1 : true}
      onNext={() => {
        if (step < 3) setStep(step + 1);
        else void api("/admin/trucks", { method: "POST", body: JSON.stringify({ binType: bin, plate, capacityKg: Number(kg) }) }, token).then(() => router.push("/admin/trucks"));
      }}
    >
      {step === 0 ? <ChoiceGrid value={bin} onChange={setBin} options={bins.map((item) => ({ id: item, label: t(locale, `bin_${item}` as MessageKey), color: binColor[item] }))} /> : null}
      {step === 1 ? <Input className="h-14 text-lg" value={plate} onChange={(event) => setPlate(event.target.value)} /> : null}
      {step === 2 ? <Input className="h-14 text-lg" type="number" value={kg} onChange={(event) => setKg(event.target.value)} /> : null}
      {step === 3 ? <p className="text-xl">{plate} · {bin} · {kg} kg</p> : null}
    </Wizard>
  );
}
