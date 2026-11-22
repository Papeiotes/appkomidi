"use client";

import { t, type Locale } from "@vardia/shared";
import { useState } from "react";
import { MapPicker } from "@/components/maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Shift } from "@/lib/api";

export type ShiftDraft = {
  title: string;
  direction: "TO_WORK" | "FROM_WORK";
  departsAt: string;
  capacity: number;
  lockMinutes: number;
  notes: string;
  driverEmail: string;
  vehicleId: string;
  musterLat: number;
  musterLng: number;
  musterLabel: string;
  destLat: number;
  destLng: number;
  destLabel: string;
  publish: boolean;
};

function tomorrowMorning() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(7, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toLocalInput(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ShiftForm({
  locale,
  token,
  vehicles,
  initial,
  fallback,
  pending,
  onSubmit,
}: {
  locale: Locale;
  token: string;
  vehicles: { id: string; plate: string; seats: number; label: string | null }[];
  initial?: Shift;
  fallback: { lat: number; lng: number; label: string };
  pending: boolean;
  onSubmit: (draft: ShiftDraft) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "Πρωινή");
  const [direction, setDirection] = useState<"TO_WORK" | "FROM_WORK">(initial?.direction ?? "TO_WORK");
  const [departsAt, setDepartsAt] = useState(initial ? toLocalInput(initial.departsAt) : tomorrowMorning());
  const [capacity, setCapacity] = useState(initial?.capacity ?? 8);
  const [lockMinutes, setLockMinutes] = useState(initial?.lockMinutes ?? 30);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [driverEmail, setDriverEmail] = useState(initial?.driver?.email ?? "");
  const [vehicleId, setVehicleId] = useState(initial?.vehicle?.id ?? "");
  const [muster, setMuster] = useState(initial?.muster ?? fallback);
  const [dest, setDest] = useState(initial?.destination ?? fallback);
  const [pinMode, setPinMode] = useState<"muster" | "dest">("muster");
  const point = pinMode === "muster" ? muster : dest;

  function submit(publish: boolean) {
    void onSubmit({
      title,
      direction,
      departsAt: new Date(departsAt).toISOString(),
      capacity: Number(capacity),
      lockMinutes: Number(lockMinutes),
      notes,
      driverEmail,
      vehicleId,
      musterLat: muster.lat,
      musterLng: muster.lng,
      musterLabel: muster.label,
      destLat: dest.lat,
      destLng: dest.lng,
      destLabel: dest.label,
      publish,
    });
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <Label>{t(locale, "title")}</Label>
          <Input className="h-10" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className="grid gap-1.5">
          <Label>{t(locale, "direction")}</Label>
          <select className="h-10 rounded-lg border border-input bg-card px-2" value={direction} onChange={(event) => setDirection(event.target.value as "TO_WORK" | "FROM_WORK")}>
            <option value="TO_WORK">{t(locale, "toWork")}</option>
            <option value="FROM_WORK">{t(locale, "fromWork")}</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <Label>{t(locale, "departs")}</Label>
          <Input className="h-10" type="datetime-local" value={departsAt} onChange={(event) => setDepartsAt(event.target.value)} required />
        </label>
        <label className="grid gap-1.5">
          <Label>{t(locale, "capacity")}</Label>
          <Input className="h-10" type="number" min={1} max={60} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} required />
        </label>
        <label className="grid gap-1.5">
          <Label>{t(locale, "lockMinutes")}</Label>
          <Input className="h-10" type="number" min={0} max={1440} value={lockMinutes} onChange={(event) => setLockMinutes(Number(event.target.value))} />
          <span className="text-xs text-muted-foreground">{t(locale, "lockHint")}</span>
        </label>
        <label className="grid gap-1.5">
          <Label>{t(locale, "driverEmail")}</Label>
          <Input className="h-10" type="email" value={driverEmail} onChange={(event) => setDriverEmail(event.target.value)} placeholder={t(locale, "optional")} />
          <span className="text-xs text-muted-foreground">{t(locale, "driverEmailHint")}</span>
        </label>
        <label className="grid gap-1.5">
          <Label>{t(locale, "vehicle")}</Label>
          <select className="h-10 rounded-lg border border-input bg-card px-2" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="">{t(locale, "noVehicle")}</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate} · {vehicle.seats}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1.5">
        <Label>{t(locale, "notes")}</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button type="button" variant={pinMode === "muster" ? "default" : "outline"} onClick={() => setPinMode("muster")}>
          {t(locale, "muster")}
        </Button>
        <Button type="button" variant={pinMode === "dest" ? "default" : "outline"} onClick={() => setPinMode("dest")}>
          {t(locale, "destination")}
        </Button>
      </div>
      <label className="grid gap-1.5">
        <Label>{pinMode === "muster" ? t(locale, "muster") : t(locale, "destination")}</Label>
        <Input
          className="h-10"
          value={point.label}
          onChange={(event) => {
            const label = event.target.value;
            if (pinMode === "muster") setMuster({ ...muster, label });
            else setDest({ ...dest, label });
          }}
        />
      </label>
      <MapPicker
        locale={locale}
        token={token}
        lat={point.lat}
        lng={point.lng}
        onChange={(next) => {
          const updated = { lat: next.lat, lng: next.lng, label: next.label ?? point.label };
          if (pinMode === "muster") setMuster(updated);
          else setDest(updated);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => void submit(false)}>
          {t(locale, "saveDraft")}
        </Button>
        <Button type="button" disabled={pending} onClick={() => void submit(true)}>
          {t(locale, "publish")}
        </Button>
      </div>
    </form>
  );
}
