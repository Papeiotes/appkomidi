"use client";

import { haversineMeters, t } from "@vardia/shared";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { LiveMap } from "@/components/maps";
import { Shell } from "@/components/shell";
import { API_URL, api, type BookingRow, type Shift } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function TrackPage() {
  const auth = useAuth();
  const params = useParams<{ shiftId: string }>();
  const locale = auth.locale;
  const [shift, setShift] = useState<Shift | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [arrived, setArrived] = useState(false);
  const [driver, setDriver] = useState<{ lat: number; lng: number } | null>(null);
  const [line, setLine] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!auth.ready) return;
    if (!auth.token) return;
    let stop = false;
    const load = async () => {
      const body = await api<{ shift: Shift; bookings: BookingRow[]; arrived: boolean }>(`/shifts/${params.shiftId}`, {}, auth.token);
      if (stop) return;
      setShift(body.shift);
      setBookings(body.bookings);
      setArrived(body.arrived);
      if (body.shift.location) setDriver({ lat: body.shift.location.lat, lng: body.shift.location.lng });
      const route = await api<{ route: { geometry: { coordinates: [number, number][] } } | null }>(
        `/shifts/${params.shiftId}/route`,
        {},
        auth.token,
      );
      if (!stop && route.route) setLine(route.route.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
    };
    void load();
    const timer = setInterval(load, 8000);
    const socket = io(API_URL, { auth: { token: auth.token } });
    socket.emit("shift:join", params.shiftId);
    socket.on("shift:location", (payload: { lat: number; lng: number }) => setDriver({ lat: payload.lat, lng: payload.lng }));
    socket.on("shift:arrival", () => setArrived(true));
    socket.on("shift:status", () => void load());
    return () => {
      stop = true;
      clearInterval(timer);
      socket.disconnect();
    };
  }, [auth.ready, auth.token, params.shiftId]);

  const mine = bookings.find((booking) => booking.rider?.id === auth.user?.id) ?? bookings[0];
  const distance = driver && mine ? Math.round(haversineMeters(driver, mine.pickup)) : null;

  return (
    <Shell>
      <h1 className="font-serif text-4xl">{shift?.title ?? t(locale, "track")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {shift?.status === "IN_PROGRESS" ? t(locale, "vanHere") : t(locale, "waitingForDriver")}
        {distance != null ? ` · ${t(locale, "metersAway", { m: distance })}` : ""}
      </p>
      {arrived ? <p className="mt-3 rounded-xl bg-accent px-3 py-2 text-sm">{t(locale, "arrived")}</p> : null}
      <div className="mt-4">
        <LiveMap driver={driver} line={line} stops={mine ? [mine.pickup] : []} />
      </div>
    </Shell>
  );
}
