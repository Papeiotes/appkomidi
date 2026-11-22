"use client";

import { t } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPicker } from "@/components/maps";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const auth = useAuth();
  const router = useRouter();
  const locale = auth.locale;
  const [form, setForm] = useState({
    username: "",
    password: "",
    businessName: "",
    afm: "",
    phone: "",
    contactName: "",
    street: "",
    streetNumber: "",
    addressLabel: "",
  });
  const [lat, setLat] = useState(37.9838);
  const [lng, setLng] = useState(23.7275);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <Shell>
      <form
        className="mx-auto grid max-w-2xl gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!confirmed) {
            setError("BAD_INPUT");
            return;
          }
          setError(null);
          try {
            const body = await api<{ token: string; user: User }>("/auth/register", {
              method: "POST",
              body: JSON.stringify({ ...form, lat, lng, locale, addressLabel: form.addressLabel || `${form.street} ${form.streetNumber}` }),
            });
            auth.login(body.token, body.user);
            router.push("/business");
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
          }
        }}
      >
        <h1 className="text-3xl font-semibold">{t(locale, "registerTitle")}</h1>
        <ErrorNote code={error} locale={locale} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t(locale, "businessName")} value={form.businessName} onChange={(value) => set("businessName", value)} />
          <Field label={t(locale, "afm")} value={form.afm} onChange={(value) => set("afm", value)} />
          <Field label={t(locale, "phone")} value={form.phone} onChange={(value) => set("phone", value)} />
          <Field label={t(locale, "contactName")} value={form.contactName} onChange={(value) => set("contactName", value)} />
          <Field label={t(locale, "username")} value={form.username} onChange={(value) => set("username", value)} />
          <Field label={t(locale, "password")} value={form.password} onChange={(value) => set("password", value)} type="password" />
          <Field label={t(locale, "street")} value={form.street} onChange={(value) => set("street", value)} />
          <Field label={t(locale, "streetNumber")} value={form.streetNumber} onChange={(value) => set("streetNumber", value)} />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            const query = `${form.street} ${form.streetNumber}`;
            const body = await api<{ results: { label: string; lat: number; lng: number }[] }>(
              `/geo/search?q=${encodeURIComponent(query)}`,
            );
            const first = body.results[0];
            if (!first) return;
            setLat(first.lat);
            setLng(first.lng);
            setForm((current) => ({ ...current, addressLabel: first.label }));
            setConfirmed(false);
          }}
        >
          {t(locale, "searchAddress")}
        </Button>
        <p className="text-sm text-muted-foreground">{t(locale, "pinHelp")}</p>
        <MapPicker
          locale={locale}
          lat={lat}
          lng={lng}
          onChange={(next) => {
            setLat(next.lat);
            setLng(next.lng);
            if (next.label) setForm((current) => ({ ...current, addressLabel: next.label ?? current.addressLabel }));
            setConfirmed(false);
          }}
        />
        <Button type="button" variant={confirmed ? "secondary" : "default"} onClick={() => setConfirmed(true)}>
          {confirmed ? t(locale, "pinConfirmed") : t(locale, "confirmPin")}
        </Button>
        <Button className="h-10" type="submit" disabled={!confirmed}>
          {t(locale, "createAccount")}
        </Button>
      </form>
    </Shell>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <Label>{label}</Label>
      <Input className="h-10" type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}
