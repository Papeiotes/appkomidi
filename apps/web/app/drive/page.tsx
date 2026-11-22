"use client";

import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { useEffect, useState } from "react";
import { LiveMap } from "@/components/maps";
import { binColor } from "@/components/wizard";
import { ApiError, api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Stop = {
  id: string;
  status: string;
  scheduledAt: string;
  business: string;
  phone: string;
  label: string;
  kg: number;
  bracket: string;
  binType: string;
  lat: number;
  lng: number;
};
type Payload = {
  shift: { id: string; status: string; binType: string; startsAt: string; lastLat: number | null; lastLng: number | null } | null;
  stops: Stop[];
  nextStopId: string | null;
  leg: { coordinates: [number, number][] } | null;
};

export default function DrivePage() {
  const auth = useRequire("DRIVER");
  const locale = auth.locale;
  const [data, setData] = useState<Payload | null>(null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!auth.token) return;
    setData(await api<Payload>("/driver/shift", {}, auth.token));
  }
  useEffect(() => {
    if (!auth.token) return;
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [auth.token]);

  const shift = data?.shift;
  const next = data?.stops.find((stop) => stop.id === data.nextStopId);
  const line = (data?.leg?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);
  const here = shift?.lastLat != null && shift.lastLng != null ? { lat: shift.lastLat, lng: shift.lastLng } : null;

  async function hereNow() {
    if (!navigator.geolocation) return { lat: 37.9838, lng: 23.7275 };
    return new Promise<{ lat: number; lng: number }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve({ lat: 37.9838, lng: 23.7275 }),
      );
    });
  }

  return (
    <div className="relative h-screen bg-white">
      <LiveMap
        className="h-full w-full"
        driver={here}
        line={line}
        stops={next ? [{ lat: next.lat, lng: next.lng, label: next.business }] : []}
      />
      <button type="button" className="absolute top-4 right-4 rounded-full bg-white px-4 py-2 text-sm shadow" onClick={() => setMenu((open) => !open)}>
        {t(locale, "menu")}
      </button>
      {menu && shift ? (
        <div className="absolute top-16 right-4 grid w-48 gap-2 rounded-2xl bg-white p-3 shadow">
          {shift.status === "IN_PROGRESS" ? <button type="button" onClick={() => void api(`/driver/shifts/${shift.id}/pause`, { method: "POST" }, auth.token).then(load)}>{t(locale, "pause")}</button> : null}
          {shift.status === "PAUSED" ? <button type="button" onClick={() => void api(`/driver/shifts/${shift.id}/resume`, { method: "POST" }, auth.token).then(load)}>{t(locale, "resume")}</button> : null}
          {shift.status !== "SCHEDULED" ? <button type="button" onClick={() => void api(`/driver/shifts/${shift.id}/end`, { method: "POST" }, auth.token).then(load)}>{t(locale, "endShift")}</button> : null}
          {shift.status === "IN_PROGRESS" ? <button type="button" onClick={() => void api(`/driver/shifts/${shift.id}/simulate`, { method: "POST", body: "{}" }, auth.token).then(load)}>{t(locale, "simulate")}</button> : null}
          <button type="button" onClick={() => auth.logout()}>{t(locale, "logout")}</button>
        </div>
      ) : null}
      {error ? <p className="absolute top-4 left-4 rounded-xl bg-white px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {shift?.status === "SCHEDULED" ? (
        <button
          type="button"
          className="absolute bottom-8 left-1/2 h-20 w-[min(90%,24rem)] -translate-x-1/2 rounded-full bg-primary text-2xl font-semibold text-white shadow-lg"
          onClick={() => {
            void hereNow().then((point) =>
              api(`/driver/shifts/${shift.id}/start`, { method: "POST", body: JSON.stringify(point) }, auth.token)
                .then(load)
                .catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED")),
            );
          }}
        >
          {t(locale, "startShift")}
        </button>
      ) : null}
      {next && shift?.status !== "SCHEDULED" ? (
        <div className="absolute right-3 bottom-3 left-3 rounded-3xl bg-white p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full" style={{ background: binColor[next.binType] }} />
            <p className="text-xl font-semibold">{next.business}</p>
          </div>
          <p className="mt-2 text-muted-foreground">{next.label}</p>
          <p className="mt-1">{t(locale, `bin_${next.binType}` as MessageKey)} · {t(locale, `bracket_${next.bracket}` as MessageKey)}</p>
          <p className="mt-1">{t(locale, "windowLabel")}: {formatWhen(next.scheduledAt, locale)} ±15</p>
          <p>{t(locale, "phone")}: {next.phone}</p>
          {shift?.status === "IN_PROGRESS" ? (
            <button type="button" className="mt-4 h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-white" onClick={() => void api(`/driver/shifts/${shift.id}/complete`, { method: "POST" }, auth.token).then(load)}>
              {t(locale, "completeStop")}
            </button>
          ) : null}
        </div>
      ) : null}
      {!shift ? <p className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-white px-5 py-3 shadow">{t(locale, "noShift")}</p> : null}
    </div>
  );
}
