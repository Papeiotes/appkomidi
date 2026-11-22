"use client";

import { haversineMeters, t } from "@vardia/shared";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { StatusBadge } from "@/components/bits";
import { LiveMap } from "@/components/maps";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { API_URL, ApiError, api, type BookingRow, type Shift } from "@/lib/api";
import { useRequire } from "@/lib/auth";

export default function DriveRunPage() {
  const auth = useRequire("DRIVER");
  const params = useParams<{ shiftId: string }>();
  const locale = auth.locale;
  const [shift, setShift] = useState<Shift | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [driver, setDriver] = useState<{ lat: number; lng: number } | null>(null);
  const [line, setLine] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!auth.token) return;
    const body = await api<{ shift: Shift; bookings: BookingRow[] }>(`/shifts/${params.shiftId}`, {}, auth.token);
    setShift(body.shift);
    setBookings(body.bookings);
    if (body.shift.location) setDriver({ lat: body.shift.location.lat, lng: body.shift.location.lng });
    const route = await api<{ route: { geometry: { coordinates: [number, number][] } } | null }>(
      `/shifts/${params.shiftId}/route${body.shift.location ? `?lat=${body.shift.location.lat}&lng=${body.shift.location.lng}` : ""}`,
      {},
      auth.token,
    );
    if (route.route) setLine(route.route.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
  }

  useEffect(() => {
    if (!auth.token) return;
    load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
    const socket: Socket = io(API_URL, { auth: { token: auth.token } });
    socket.emit("shift:join", params.shiftId);
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, params.shiftId]);

  useEffect(() => {
    if (!auth.token || shift?.status !== "IN_PROGRESS" || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setDriver({ lat, lng });
      void api(`/driver/shifts/${params.shiftId}/location`, {
        method: "POST",
        body: JSON.stringify({ lat, lng, heading: position.coords.heading, speed: position.coords.speed }),
      }, auth.token).catch(() => undefined);
    });
    return () => navigator.geolocation.clearWatch(watch);
  }, [auth.token, params.shiftId, shift?.status]);

  return (
    <Shell>
      <h1 className="font-serif text-4xl">{shift?.title ?? t(locale, "navDrive")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(locale, "keepOpen")}</p>
      <ErrorNote code={error} locale={locale} />
      <div className="mt-3 flex flex-wrap gap-2">
        {shift && (shift.status === "OPEN" || shift.status === "LOCKED") ? (
          <Button
            onClick={async () => {
              try {
                await api(`/driver/shifts/${params.shiftId}/start`, { method: "POST" }, auth.token);
                await load();
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
              }
            }}
          >
            {t(locale, "start")}
          </Button>
        ) : null}
        {shift?.status === "IN_PROGRESS" ? (
          <>
            <Button
              variant="outline"
              onClick={() => {
                navigator.geolocation.getCurrentPosition(async (position) => {
                  const lat = position.coords.latitude;
                  const lng = position.coords.longitude;
                  setDriver({ lat, lng });
                  await api(`/driver/shifts/${params.shiftId}/location`, { method: "POST", body: JSON.stringify({ lat, lng }) }, auth.token);
                  await load();
                });
              }}
            >
              {t(locale, "sendLocation")}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await api(`/driver/shifts/${params.shiftId}/complete`, { method: "POST" }, auth.token);
                  await load();
                } catch (caught) {
                  setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
                }
              }}
            >
              {t(locale, "complete")}
            </Button>
          </>
        ) : null}
      </div>
      <div className="mt-4">
        <LiveMap driver={driver} line={line} stops={bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.pickup)} />
      </div>
      <h2 className="mt-6 font-serif text-2xl">{t(locale, "passengers")}</h2>
      <ul className="mt-2 grid gap-2">
        {bookings.map((booking) => {
          const distance = driver ? Math.round(haversineMeters(driver, booking.pickup)) : null;
          return (
            <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <span>
                {booking.rider?.name} · {booking.pickup.label}
                {distance != null ? ` · ${t(locale, "metersAway", { m: distance })}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge kind="booking" status={booking.status} locale={locale} />
                {shift?.status === "IN_PROGRESS" && booking.status === "CONFIRMED" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await api(`/driver/shifts/${params.shiftId}/simulate`, { method: "POST", body: JSON.stringify({ bookingId: booking.id }) }, auth.token);
                        await load();
                      }}
                    >
                      {t(locale, "simulate")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api(`/driver/shifts/${params.shiftId}/bookings/${booking.id}/no-show`, { method: "POST" }, auth.token);
                        await load();
                      }}
                    >
                      {t(locale, "noShow")}
                    </Button>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{t(locale, "simulateHint")}</p>
    </Shell>
  );
}
