"use client";

import { t } from "@vardia/shared";
import { useEffect, useState } from "react";
import { MapPicker } from "@/components/maps";
import { Wizard } from "@/components/wizard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Biz = { id: string; name: string; afm: string; addressLabel: string; lat: number; lng: number; user: { username: string } };

export default function ApprovalsPage() {
  const { locale, token } = useAuth();
  const [rows, setRows] = useState<Biz[]>([]);
  const [current, setCurrent] = useState<Biz | null>(null);
  const [step, setStep] = useState(0);
  const [lat, setLat] = useState(37.98);
  const [lng, setLng] = useState(23.73);

  async function load() {
    const body = await api<{ businesses: Biz[] }>("/admin/businesses?status=PENDING", {}, token);
    setRows(body.businesses);
  }
  useEffect(() => {
    if (token) void load();
  }, [token]);

  if (current) {
    return (
      <Wizard
        step={step}
        total={2}
        title={step === 0 ? current.name : t(locale, "review")}
        onBack={step === 0 ? () => setCurrent(null) : () => setStep(0)}
        onNext={() => (step === 0 ? setStep(1) : void api(`/admin/businesses/${current.id}/approve`, { method: "POST", body: JSON.stringify({ lat, lng }) }, token).then(() => { setCurrent(null); return load(); }))}
        nextLabel={step === 1 ? t(locale, "approve") : undefined}
      >
        {step === 0 ? <MapPicker locale={locale} token={token} lat={lat} lng={lng} onChange={(next) => { setLat(next.lat); setLng(next.lng); }} /> : <p className="text-lg">{current.addressLabel}</p>}
      </Wizard>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(locale, "navApprovals")}</h1>
      {rows.length === 0 ? <p className="mt-6 text-muted-foreground">{t(locale, "empty")}</p> : null}
      <ul className="mt-6 grid gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <Button className="h-16 w-full justify-start rounded-2xl px-4 text-left" variant="outline" onClick={() => { setCurrent(row); setLat(row.lat); setLng(row.lng); setStep(0); }}>
              {row.name} · {row.afm}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
