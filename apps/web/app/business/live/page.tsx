"use client";

import { t } from "@vardia/shared";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { LiveMap } from "@/components/maps";
import { Shell } from "@/components/shell";
import { API_URL, api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

function LiveInner() {
  const auth = useRequire("BUSINESS");
  const id = useSearchParams().get("id") ?? "";
  const locale = auth.locale;
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token || !id) return;
    let socket: ReturnType<typeof io> | null = null;
    api<{ booking: { arrivalOpen: boolean }; shift: { id: string; lastLat: number | null; lastLng: number | null }; eta: string | null }>(`/bookings/${id}/live`, {}, auth.token).then((body) => {
      setOpen(body.booking.arrivalOpen);
      setEta(body.eta);
      if (body.shift.lastLat != null && body.shift.lastLng != null) setPoint({ lat: body.shift.lastLat, lng: body.shift.lastLng });
      socket = io(API_URL, { auth: { token: auth.token } });
      socket.emit("shift:join", body.shift.id);
      socket.on("shift:location", (payload: { lat: number; lng: number }) => setPoint(payload));
      socket.on("shift:arrival", () => setOpen(true));
    });
    return () => {
      socket?.disconnect();
    };
  }, [auth.token, id]);

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{open ? t(locale, "arrivedTitle") : t(locale, "onTheWay")}</h1>
      {eta ? <p className="mt-2 text-muted-foreground">{t(locale, "eta")}: {new Date(eta).toLocaleTimeString()}</p> : null}
      <div className="mt-4">
        <LiveMap driver={point} line={[]} stops={[]} className="h-[28rem] overflow-hidden rounded-3xl" />
      </div>
    </Shell>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <LiveInner />
    </Suspense>
  );
}
