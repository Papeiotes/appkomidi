"use client";

import { t } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { MapPicker } from "@/components/maps";
import { Wizard } from "@/components/wizard";
import { Input } from "@/components/ui/input";
import { ApiError, api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const auth = useAuth();
  const router = useRouter();
  const locale = auth.locale;
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [afm, setAfm] = useState("");
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [lat, setLat] = useState(37.9838);
  const [lng, setLng] = useState(23.7275);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const titles = [t(locale, "businessName"), t(locale, "afm"), t(locale, "phone"), t(locale, "contactName"), t(locale, "street"), t(locale, "confirmPin"), t(locale, "username"), t(locale, "password"), t(locale, "review")];
  return (
    <Shell>
      <Wizard
        step={step}
        total={titles.length}
        title={titles[step]}
        onBack={step ? () => setStep(step - 1) : undefined}
        nextLabel={step === 8 ? t(locale, "createAccount") : undefined}
        canNext={step === 1 ? afm.length === 9 : step === 7 ? password.length >= 8 : true}
        onNext={() => {
          if (step < 8) setStep(step + 1);
          else {
            setError(null);
            void api<{ token: string; user: User }>("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                username, password, businessName, afm, phone, contactName: contact, street, streetNumber: number,
                addressLabel: `${street} ${number}, Αθήνα`, lat, lng, locale,
              }),
            }).then((body) => {
              auth.login(body.token, body.user);
              router.push("/business");
            }).catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
          }
        }}
      >
        {step === 0 ? <Input className="h-14 text-lg" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /> : null}
        {step === 1 ? <Input className="h-14 text-lg" value={afm} onChange={(e) => setAfm(e.target.value)} /> : null}
        {step === 2 ? <Input className="h-14 text-lg" value={phone} onChange={(e) => setPhone(e.target.value)} /> : null}
        {step === 3 ? <Input className="h-14 text-lg" value={contact} onChange={(e) => setContact(e.target.value)} /> : null}
        {step === 4 ? (
          <div className="grid gap-3">
            <Input className="h-14" placeholder={t(locale, "street")} value={street} onChange={(e) => setStreet(e.target.value)} />
            <Input className="h-14" placeholder={t(locale, "streetNumber")} value={number} onChange={(e) => setNumber(e.target.value)} />
            <button type="button" className="text-left text-primary" onClick={() => void api<{ results: { lat: number; lng: number }[] }>(`/geo/search?q=${encodeURIComponent(`${street} ${number} Αθήνα`)}`).then((body) => { if (body.results[0]) { setLat(body.results[0].lat); setLng(body.results[0].lng); } })}>{t(locale, "searchAddress")}</button>
          </div>
        ) : null}
        {step === 5 ? <MapPicker locale={locale} lat={lat} lng={lng} onChange={(next) => { setLat(next.lat); setLng(next.lng); }} /> : null}
        {step === 6 ? <Input className="h-14 text-lg" value={username} onChange={(e) => setUsername(e.target.value)} /> : null}
        {step === 7 ? <Input className="h-14 text-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /> : null}
        {step === 8 ? <div className="rounded-2xl bg-secondary p-5 text-lg"><p>{businessName}</p><p>{street} {number}</p>{error ? <p className="text-destructive">{error}</p> : null}</div> : null}
      </Wizard>
    </Shell>
  );
}
