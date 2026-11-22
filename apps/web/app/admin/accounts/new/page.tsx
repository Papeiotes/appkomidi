"use client";

import { OFFICE_PERMISSIONS, t, type MessageKey } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChoiceGrid, Wizard, binColor } from "@/components/wizard";
import { MapPicker } from "@/components/maps";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const roles = ["BUSINESS", "OFFICE", "DRIVER", "ADMIN"] as const;
const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;

export default function NewAccountPage() {
  const { locale, token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<(typeof roles)[number] | "">("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bin, setBin] = useState("");
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("800");
  const [perms, setPerms] = useState<string[]>([...OFFICE_PERMISSIONS]);
  const [businessName, setBusinessName] = useState("");
  const [afm, setAfm] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [lat, setLat] = useState(37.9838);
  const [lng, setLng] = useState(23.7275);

  const flow =
    role === "DRIVER"
      ? ["role", "name", "username", "password", "bin", "plate", "kg", "review"]
      : role === "OFFICE"
        ? ["role", "name", "username", "password", "perms", "review"]
        : role === "BUSINESS"
          ? ["role", "biz", "afm", "phone", "address", "pin", "username", "password", "review"]
          : ["role", "name", "username", "password", "review"];
  const current = flow[step] ?? "role";

  async function save() {
    if (role === "BUSINESS") {
      await api(
        "/admin/businesses",
        {
          method: "POST",
          body: JSON.stringify({
            username, password, businessName, afm, phone, contactName: name || businessName,
            street, streetNumber: number, addressLabel: `${street} ${number}`, lat, lng,
          }),
        },
        token,
      );
    } else {
      await api(
        "/admin/users",
        {
          method: "POST",
          body: JSON.stringify({
            username, password, name, role, permissions: perms,
            binType: bin || undefined, plate: plate || undefined, capacityKg: Number(capacity) || undefined, phone,
          }),
        },
        token,
      );
    }
    router.push("/admin/accounts");
  }

  const titles: Record<string, string> = {
    role: t(locale, "pickRole"),
    name: t(locale, "fullName"),
    username: t(locale, "username"),
    password: t(locale, "password"),
    bin: t(locale, "pickBin"),
    plate: t(locale, "plate"),
    kg: t(locale, "capacityKg"),
    perms: t(locale, "permissions"),
    biz: t(locale, "businessName"),
    afm: t(locale, "afm"),
    phone: t(locale, "phone"),
    address: t(locale, "street"),
    pin: t(locale, "confirmPin"),
    review: t(locale, "review"),
  };

  return (
    <Wizard
      step={step}
      total={flow.length}
      title={titles[current]}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      onNext={() => (current === "review" ? void save() : setStep(step + 1))}
      nextLabel={current === "review" ? t(locale, "save") : undefined}
      canNext={
        current === "role" ? Boolean(role) :
        current === "name" || current === "username" || current === "password" || current === "biz" || current === "afm" ? Boolean(
          current === "name" ? name : current === "username" ? username : current === "password" ? password.length >= 8 : current === "biz" ? businessName : afm.length === 9,
        ) :
        current === "bin" ? Boolean(bin) :
        current === "plate" ? plate.length >= 2 :
        true
      }
    >
      {current === "role" ? (
        <ChoiceGrid
          value={role}
          onChange={(id) => setRole(id as typeof role)}
          options={roles.map((item) => ({
            id: item,
            label: t(locale, item === "BUSINESS" ? "roleBusiness" : item === "OFFICE" ? "roleOffice" : item === "DRIVER" ? "roleDriver" : "roleAdmin"),
          }))}
        />
      ) : null}
      {current === "name" || current === "username" || current === "password" || current === "biz" || current === "afm" || current === "phone" || current === "plate" || current === "kg" ? (
        <Input
          className="h-14 text-lg"
          type={current === "password" ? "password" : current === "kg" ? "number" : "text"}
          value={current === "name" ? name : current === "username" ? username : current === "password" ? password : current === "biz" ? businessName : current === "afm" ? afm : current === "phone" ? phone : current === "plate" ? plate : capacity}
          onChange={(event) => {
            const value = event.target.value;
            if (current === "name") setName(value);
            if (current === "username") setUsername(value);
            if (current === "password") setPassword(value);
            if (current === "biz") setBusinessName(value);
            if (current === "afm") setAfm(value);
            if (current === "phone") setPhone(value);
            if (current === "plate") setPlate(value);
            if (current === "kg") setCapacity(value);
          }}
        />
      ) : null}
      {current === "bin" ? (
        <ChoiceGrid value={bin} onChange={setBin} options={bins.map((item) => ({ id: item, label: t(locale, `bin_${item}` as MessageKey), color: binColor[item] }))} />
      ) : null}
      {current === "perms" ? (
        <div className="grid gap-2">
          {OFFICE_PERMISSIONS.map((permission) => (
            <label key={permission} className="flex min-h-12 items-center gap-3 rounded-xl border px-3">
              <input type="checkbox" checked={perms.includes(permission)} onChange={() => setPerms((currentPerms) => currentPerms.includes(permission) ? currentPerms.filter((item) => item !== permission) : [...currentPerms, permission])} />
              {t(locale, permission === "bookings.view" ? "perm_view" : permission === "bookings.reschedule" ? "perm_reschedule" : permission === "bookings.cancel" ? "perm_cancel" : permission === "bookings.question" ? "perm_question" : permission === "slots.toggle" ? "perm_slots" : "perm_stats")}
            </label>
          ))}
        </div>
      ) : null}
      {current === "address" ? (
        <div className="grid gap-3">
          <Input className="h-12" placeholder={t(locale, "street")} value={street} onChange={(event) => setStreet(event.target.value)} />
          <Input className="h-12" placeholder={t(locale, "streetNumber")} value={number} onChange={(event) => setNumber(event.target.value)} />
        </div>
      ) : null}
      {current === "pin" ? <MapPicker locale={locale} token={token} lat={lat} lng={lng} onChange={(next) => { setLat(next.lat); setLng(next.lng); }} /> : null}
      {current === "review" ? (
        <div className="rounded-2xl bg-secondary p-5 text-lg leading-8">
          <p>{role}</p>
          <p>{name || businessName}</p>
          <p>{username}</p>
          {plate ? <p>{plate} · {bin} · {capacity} kg</p> : null}
        </div>
      ) : null}
    </Wizard>
  );
}
