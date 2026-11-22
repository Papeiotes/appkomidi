"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MapPicker } from "@/components/maps";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, homeFor, type Role, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const roles = ["BUSINESS_OWNER", "DRIVER", "EMPLOYEE"] as const;

export default function RegisterPage() {
  const auth = useAuth();
  const router = useRouter();
  const locale = auth.locale;
  const [role, setRole] = useState<(typeof roles)[number]>("BUSINESS_OWNER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("Αθήνα");
  const [lat, setLat] = useState(37.9838);
  const [lng, setLng] = useState(23.7275);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const hint = role === "BUSINESS_OWNER" ? "roleBusinessHint" : role === "DRIVER" ? "roleDriverHint" : "roleEmployeeHint";

  return (
    <Shell>
      <form
        className="mx-auto grid max-w-2xl gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          try {
            const body = await api<{ token: string; user: User }>("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                email,
                password,
                name,
                phone,
                locale,
                role,
                inviteCode: role === "EMPLOYEE" ? inviteCode : undefined,
                business:
                  role === "BUSINESS_OWNER"
                    ? { name: businessName, taxId, address, lat, lng }
                    : undefined,
              }),
            });
            auth.login(body.token, body.user);
            router.push(homeFor(body.user.role as Role));
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
          } finally {
            setPending(false);
          }
        }}
      >
        <div>
          <h1 className="font-serif text-4xl">{t(locale, "registerTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(locale, hint)}</p>
        </div>
        <ErrorNote code={error} locale={locale} />
        <div className="grid gap-2 sm:grid-cols-3">
          {roles.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-xl border px-3 py-3 text-left text-sm ${role === item ? "border-primary bg-secondary" : "border-border bg-card"}`}
              onClick={() => setRole(item)}
            >
              {t(locale, item === "BUSINESS_OWNER" ? "roleBusiness" : item === "DRIVER" ? "roleDriver" : "roleEmployee")}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t(locale, "name")}>
            <Input className="h-10" value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label={t(locale, "phone")}>
            <Input className="h-10" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label={t(locale, "email")}>
            <Input className="h-10" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label={t(locale, "password")}>
            <Input className="h-10" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">{t(locale, "passwordRule")}</p>
        {role === "EMPLOYEE" ? (
          <Field label={t(locale, "inviteCode")}>
            <Input className="h-10 uppercase" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required />
          </Field>
        ) : null}
        {role === "BUSINESS_OWNER" ? (
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t(locale, "businessName")}>
                <Input className="h-10" value={businessName} onChange={(event) => setBusinessName(event.target.value)} required />
              </Field>
              <Field label={t(locale, "taxId")}>
                <Input className="h-10" value={taxId} onChange={(event) => setTaxId(event.target.value)} />
              </Field>
            </div>
            <Field label={t(locale, "address")}>
              <Input className="h-10" value={address} onChange={(event) => setAddress(event.target.value)} required />
            </Field>
            <p className="text-sm text-muted-foreground">{t(locale, "pinHelp")}</p>
            <MapPicker
              locale={locale}
              lat={lat}
              lng={lng}
              onChange={(next) => {
                setLat(next.lat);
                setLng(next.lng);
                if (next.label) setAddress(next.label);
              }}
            />
          </div>
        ) : null}
        <Button className="h-10" type="submit" disabled={pending}>
          {pending ? t(locale, "loading") : t(locale, "createAccount")}
        </Button>
        <p className="text-sm">
          {t(locale, "hasAccount")}{" "}
          <Link className="underline" href="/login">
            {t(locale, "loginTitle")}
          </Link>
        </p>
      </form>
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
