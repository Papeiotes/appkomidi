"use client";

import { t } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPicker } from "@/components/maps";
import { Wizard } from "@/components/wizard";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function NewAreaPage() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [ring, setRing] = useState<[number, number][]>([]);
  return (
    <Wizard
      step={step}
      total={3}
      title={step === 0 ? t(locale, "subArea") : step === 1 ? t(locale, "areaHelp") : t(locale, "review")}
      onBack={step ? () => setStep(step - 1) : undefined}
      canNext={step === 0 ? name.length > 1 : step === 1 ? ring.length >= 3 : true}
      nextLabel={step === 2 ? t(locale, "save") : undefined}
      onNext={() => {
        if (step < 2) setStep(step + 1);
        else void api("/admin/areas", { method: "POST", body: JSON.stringify({ name, ring }) }, token).then(() => router.push("/admin/areas"));
      }}
    >
      {step === 0 ? <Input className="h-14 text-lg" value={name} onChange={(event) => setName(event.target.value)} /> : null}
      {step === 1 ? (
        <div>
          <MapPicker locale={locale} token={token} lat={37.975} lng={23.73} onChange={(next) => setRing((current) => [...current, [next.lng, next.lat]])} />
          <p className="mt-2 text-sm text-muted-foreground">{ring.length}</p>
        </div>
      ) : null}
      {step === 2 ? <p className="text-xl">{name}</p> : null}
    </Wizard>
  );
}
