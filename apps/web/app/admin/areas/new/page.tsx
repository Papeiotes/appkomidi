"use client";

import { t } from "@vardia/shared";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wizard } from "@/components/wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const PolygonDraw = dynamic(() => import("@/components/polygon-draw").then((mod) => mod.PolygonDraw), { ssr: false });

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
        <div className="grid gap-3">
          <PolygonDraw ring={ring} onAdd={(lng, lat) => setRing((current) => [...current, [lng, lat]])} />
          <p className="text-sm text-muted-foreground">{ring.length}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-12 flex-1" disabled={ring.length === 0} onClick={() => setRing((current) => current.slice(0, -1))}>
              {t(locale, "undoPoint")}
            </Button>
            <Button type="button" className="h-12 flex-1" disabled={ring.length < 3} onClick={() => setStep(2)}>
              {t(locale, "finishPolygon")}
            </Button>
          </div>
        </div>
      ) : null}
      {step === 2 ? <p className="text-xl">{name} · {ring.length}</p> : null}
    </Wizard>
  );
}
