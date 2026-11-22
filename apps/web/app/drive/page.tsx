"use client";

import { formatWhen, t } from "@vardia/shared";
import { useEffect, useState } from "react";
import { LiveMap } from "@/components/maps";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Stop = { id: string; status: string; scheduledAt: string; business: string; lat: number; lng: number; label: string; kg: number };
type Payload = {
  shift: { id: string; status: string; startsAt: string; binType: string; routeLocked: boolean; lastLat: number | null; lastLng: number | null } | null;
  stops: Stop[];
  nextStopId: string | null;
  leg: { coordinates: [number, number][] } | null;
};

export default function DrivePage() {
  const auth = useRequire("DRIVER");
  const locale = auth.locale;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!auth.token) return;
    setData(await api<Payload>("/driver/shift", {}, auth.token));
  }

  useEffect(() => {
    if (!auth.token) return;
    const timer = setInterval(() => void load().catch(() => undefined), 5000);
    load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
    return () => clearInterval(timer);
  }, [auth.token]);

  const shift = data?.shift;
  const next = data?.stops.find((stop) => stop.id === data.nextStopId);
  const line = (data?.leg?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);

  async function locate(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 37.98, lng: 23.73 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve({ lat: 37.98, lng: 23.73 }),
      );
    });
  }

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{t(locale, "navDrive")}</h1>
      <ErrorNote code={error} locale={locale} />
      {!shift ? <p className="mt-4 text-muted-foreground">{t(locale, "noShift")}</p> : null}
      {shift ? (
        <div className="mt-4 grid gap-3">
          <p className="text-sm text-muted-foreground">
            {shift.binType} · {formatWhen(shift.startsAt, locale)} · {shift.status}
          </p>
          {shift.status === "SCHEDULED" ? (
            <Button
              className="h-14 text-lg"
              onClick={async () => {
                const here = await locate();
                try {
                  await api(`/driver/shifts/${shift.id}/start`, { method: "POST", body: JSON.stringify(here) }, auth.token);
                  await load();
                } catch (caught) {
                  setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
                }
              }}
            >
              {t(locale, "startShift")}
            </Button>
          ) : null}
          {next ? (
            <div className="rounded-xl border border-primary/30 bg-secondary p-4">
              <p className="text-xs uppercase text-muted-foreground">{t(locale, "nextStop")}</p>
              <p className="text-xl font-semibold">{next.business}</p>
              <p className="text-sm">{next.label} · {next.kg} kg · {formatWhen(next.scheduledAt, locale)}</p>
            </div>
          ) : null}
          <LiveMap
            driver={shift.lastLat != null && shift.lastLng != null ? { lat: shift.lastLat, lng: shift.lastLng } : null}
            line={line}
            stops={data?.stops.filter((stop) => stop.status === "CONFIRMED").map((stop) => ({ lat: stop.lat, lng: stop.lng, label: stop.business })) ?? []}
          />
          <div className="flex flex-wrap gap-2">
            {shift.status === "IN_PROGRESS" ? (
              <Button className="h-12" onClick={async () => { await api(`/driver/shifts/${shift.id}/complete`, { method: "POST" }, auth.token); await load(); }}>
                {t(locale, "completeStop")}
              </Button>
            ) : null}
            {shift.status === "IN_PROGRESS" ? (
              <Button variant="outline" onClick={async () => { await api(`/driver/shifts/${shift.id}/pause`, { method: "POST" }, auth.token); await load(); }}>{t(locale, "pause")}</Button>
            ) : null}
            {shift.status === "PAUSED" ? (
              <Button onClick={async () => { await api(`/driver/shifts/${shift.id}/resume`, { method: "POST" }, auth.token); await load(); }}>{t(locale, "resume")}</Button>
            ) : null}
            {shift.status === "IN_PROGRESS" || shift.status === "PAUSED" ? (
              <Button variant="ghost" onClick={async () => { await api(`/driver/shifts/${shift.id}/end`, { method: "POST" }, auth.token); await load(); }}>{t(locale, "endShift")}</Button>
            ) : null}
            {shift.status === "IN_PROGRESS" ? (
              <Button variant="secondary" onClick={async () => { await api(`/driver/shifts/${shift.id}/simulate`, { method: "POST", body: "{}" }, auth.token); await load(); }}>{t(locale, "simulate")}</Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
