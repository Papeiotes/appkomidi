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
  shift: { id: string; status: string; binType: string; startsAt: string; lastLat: number | null; lastLng: number | null; routeOrder?: string[] } | null;
  stops: Stop[];
  nextStopId: string | null;
  eta: string | null;
  etas?: Record<string, string>;
  route: { coordinates: [number, number][] } | null;
};

const FALLBACK = { lat: 37.971, lng: 23.728 };

export default function DrivePage() {
  const auth = useRequire("DRIVER");
  const locale = auth.locale;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!auth.token) return;
    setData(await api<Payload>("/driver/shift", {}, auth.token));
  }
  useEffect(() => {
    if (!auth.token) return;
    void load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
    const timer = setInterval(() => void load().catch(() => undefined), 5000);
    return () => clearInterval(timer);
  }, [auth.token]);

  const shift = data?.shift;
  const confirmedRaw = (data?.stops ?? []).filter((stop) => stop.status === "CONFIRMED");
  const routeOrder = data?.shift?.routeOrder ?? [];
  const confirmed = routeOrder.length
    ? routeOrder.map((id) => confirmedRaw.find((stop) => stop.id === id)).filter((stop): stop is Stop => Boolean(stop))
    : confirmedRaw;
  const done = (data?.stops ?? []).filter((stop) => stop.status === "COMPLETED");
  const next = confirmed.find((stop) => stop.id === data?.nextStopId) ?? null;
  const line = (data?.route?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);
  const here = shift?.lastLat != null && shift.lastLng != null ? { lat: shift.lastLat, lng: shift.lastLng } : null;

  function hereNow() {
    return new Promise<{ lat: number; lng: number }>((resolve) => {
      const timer = setTimeout(() => resolve(FALLBACK), 2500);
      if (!navigator.geolocation) {
        clearTimeout(timer);
        resolve(FALLBACK);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timer);
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          clearTimeout(timer);
          resolve(FALLBACK);
        },
        { enableHighAccuracy: false, timeout: 2000, maximumAge: 15000 },
      );
    });
  }

  async function act(path: string, body?: string) {
    if (!shift || !auth.token) return;
    setError(null);
    setBusy(true);
    try {
      await api(`/driver/shifts/${shift.id}/${path}`, { method: "POST", body }, auth.token);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-white">
      <div className="absolute inset-0 z-0">
        <LiveMap
          className="h-full w-full"
          driver={here}
          line={line}
          stops={confirmed.map((stop) => ({ id: stop.id, lat: stop.lat, lng: stop.lng, label: stop.business, active: stop.id === next?.id }))}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1000]">
        <button type="button" className="pointer-events-auto absolute top-3 left-3 inline-flex h-11 min-h-11 items-center rounded-full bg-white px-4 text-sm shadow" onClick={() => { auth.logout(); window.location.assign("/"); }}>
          {t(locale, "logout")}
        </button>
        {error ? <p className="pointer-events-auto absolute top-3 right-3 max-w-[70%] rounded-xl bg-white px-3 py-2 text-sm text-destructive shadow">{error}</p> : null}

        {shift?.status === "SCHEDULED" ? (
          <button
            type="button"
            disabled={busy}
            className="pointer-events-auto absolute inset-x-4 bottom-4 inline-flex h-16 min-h-16 items-center justify-center rounded-full bg-primary text-2xl font-semibold tracking-wide text-white shadow-lg disabled:opacity-70 sm:inset-x-auto sm:left-1/2 sm:w-[24rem] sm:-translate-x-1/2"
            onClick={() => {
              setBusy(true);
              void hereNow().then((point) => act("start", JSON.stringify(point)));
            }}
          >
            {t(locale, "startShift")}
          </button>
        ) : null}

        {next && (shift?.status === "IN_PROGRESS" || shift?.status === "PAUSED") ? (
          <div className="pointer-events-auto absolute inset-x-2 bottom-2 max-h-[62dvh] overflow-y-auto rounded-3xl bg-white p-4 shadow-xl sm:inset-x-4 sm:p-5">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">{t(locale, "nextStop")}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: binColor[next.binType] }} />
              <p className="text-xl font-semibold">{next.business}</p>
            </div>
            <p className="mt-2 text-muted-foreground">{next.label}</p>
            <p className="mt-1">{t(locale, `bin_${next.binType}` as MessageKey)} · {t(locale, `bracket_${next.bracket}` as MessageKey)}</p>
            <p className="mt-1">{t(locale, "windowLabel")}: {formatWhen(next.scheduledAt, locale)} {t(locale, "windowFlex")}</p>
            <ol className="mt-3 grid gap-1 text-sm">
              {confirmed.map((stop, index) => (
                <li key={stop.id} className={stop.id === next.id ? "font-semibold" : "text-muted-foreground"}>
                  {index + 1}. {stop.business} · {data?.etas?.[stop.id] ? formatWhen(data.etas[stop.id], locale) : formatWhen(stop.scheduledAt, locale)}
                </li>
              ))}
            </ol>
            <p>{t(locale, "eta")}: {data?.eta ? formatWhen(data.eta, locale) : "—"}</p>
            <p>{t(locale, "phone")}: {next.phone}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                className="inline-flex h-14 min-h-11 w-full items-center justify-center rounded-2xl border border-primary text-base font-semibold text-primary"
                onClick={() => void act(shift.status === "PAUSED" ? "resume" : "pause")}
              >
                {shift.status === "PAUSED" ? t(locale, "resume") : t(locale, "pause")}
              </button>
              <button
                type="button"
                disabled={busy || shift.status !== "IN_PROGRESS"}
                className="inline-flex h-14 min-h-11 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-white disabled:opacity-50"
                onClick={() => void act("complete")}
              >
                {t(locale, "completeStop")}
              </button>
            </div>
          </div>
        ) : null}

        {shift?.status === "ENDED" ? (
          <div className="pointer-events-auto absolute inset-x-2 bottom-2 max-h-[62dvh] overflow-y-auto rounded-3xl bg-white p-4 shadow-xl sm:inset-x-4 sm:p-5">
            <p className="text-2xl font-semibold">{t(locale, "shiftDone")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t(locale, "stopsDone")}</p>
            <ul className="mt-3 grid gap-2">
              {done.map((stop) => (
                <li key={stop.id} className="text-base">{stop.business}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!shift && data ? <p className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-5 py-3 shadow">{t(locale, "noShift")}</p> : null}
      </div>
    </div>
  );
}
