"use client";

import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { LiveMap } from "@/components/maps";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { API_URL, ApiError, api, type BinType } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Slot = { at: string; remainingKg: number; bookable: boolean };
type Business = { status: string; name: string; rejectionNote: string | null };
type Mine = {
  id: string;
  status: string;
  binType: BinType;
  bracket: string;
  kg: number;
  scheduledAt: string;
  arrivalOpen: boolean;
  shift: { id: string; status: string; lastLat: number | null; lastLng: number | null };
};

const bins: BinType[] = ["GREEN", "BLUE", "YELLOW", "BROWN"];
const brackets = ["KG_0_10", "KG_10_20", "KG_20_50", "KG_50_PLUS"] as const;

export default function BusinessPage() {
  const auth = useRequire("BUSINESS");
  const locale = auth.locale;
  const [business, setBusiness] = useState<Business | null>(null);
  const [picked, setPicked] = useState<BinType[]>(["GREEN"]);
  const [bracket, setBracket] = useState<(typeof brackets)[number]>("KG_0_10");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);
  const [live, setLive] = useState<Mine | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMine() {
    if (!auth.token) return;
    const body = await api<{ bookings: Mine[] }>("/bookings/mine", {}, auth.token);
    setMine(body.bookings);
  }

  useEffect(() => {
    if (!auth.token) return;
    api<{ business: Business }>("/business", {}, auth.token)
      .then((body) => setBusiness(body.business))
      .catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token || business?.status !== "APPROVED") return;
    api<{ slots: Slot[]; suggested: string | null }>(`/slots?binType=${picked[0] ?? "GREEN"}`, {}, auth.token).then((body) => {
      setSlots(body.slots);
      setSuggested(body.suggested);
    });
    void loadMine();
  }, [auth.token, business?.status, picked]);

  useEffect(() => {
    if (!auth.token || !live) return;
    const socket = io(API_URL, { auth: { token: auth.token } });
    socket.emit("shift:join", live.shift.id);
    socket.on("shift:location", (payload: { lat: number; lng: number }) => {
      setLive((current) => (current ? { ...current, shift: { ...current.shift, lastLat: payload.lat, lastLng: payload.lng } } : current));
    });
    socket.on("shift:arrival", () => setLive((current) => (current ? { ...current, arrivalOpen: true } : current)));
    return () => {
      socket.disconnect();
    };
  }, [auth.token, live?.id]);

  if (business && business.status !== "APPROVED") {
    return (
      <Shell>
        <h1 className="text-3xl font-semibold">{t(locale, "pendingTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{business.rejectionNote || t(locale, "pendingBody")}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{business?.name ?? t(locale, "navBook")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t(locale, "disclaimer")}</p>
      <ErrorNote code={error} locale={locale} />
      <div className="mt-4 flex flex-wrap gap-2">
        {bins.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-full border px-3 py-1 text-sm ${picked.includes(item) ? "border-primary bg-secondary" : "border-border"}`}
            onClick={() =>
              setPicked((current) => (current.includes(item) ? current.filter((bin) => bin !== item) : [...current, item]))
            }
          >
            {t(locale, `bin_${item}` as MessageKey)}
          </button>
        ))}
      </div>
      <label className="mt-3 grid max-w-xs gap-1 text-sm">
        {t(locale, "statsKg")}
        <select className="h-10 rounded-lg border border-input px-2" value={bracket} onChange={(event) => setBracket(event.target.value as typeof bracket)}>
          {brackets.map((item) => (
            <option key={item} value={item}>
              {t(locale, `bracket_${item}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      {suggested ? <p className="mt-3 text-sm">{t(locale, "suggested")}: {formatWhen(suggested, locale)}</p> : null}
      {picked.map((item) => {
        const needed = bracket === "KG_0_10" ? 10 : bracket === "KG_10_20" ? 20 : bracket === "KG_20_50" ? 50 : 75;
        return (
        <label key={item} className="mt-3 grid gap-1 text-sm">
          {t(locale, `bin_${item}` as MessageKey)}
          <select
            className="h-10 rounded-lg border border-input px-2"
            value={times[item] ?? ""}
            onChange={(event) => setTimes({ ...times, [item]: event.target.value })}
          >
            <option value="">—</option>
            {slots.map((slot) => {
              const open = slot.bookable && slot.remainingKg >= needed;
              return (
              <option key={slot.at} value={slot.at} disabled={!open}>
                {formatWhen(slot.at, locale)} · {slot.remainingKg} kg {open ? "" : t(locale, "fullSlot")}
              </option>
              );
            })}
          </select>
        </label>
        );
      })}
      <Button
        className="mt-4"
        onClick={async () => {
          setError(null);
          try {
            const body = await api<{ results: { ok: boolean; code?: string }[] }>(
              "/bookings",
              {
                method: "POST",
                body: JSON.stringify({
                  items: picked.filter((item) => times[item]).map((item) => ({ binType: item, bracket, scheduledAt: times[item] })),
                }),
              },
              auth.token,
            );
            const failed = body.results.find((result) => !result.ok);
            if (failed?.code) setError(failed.code);
            await loadMine();
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
          }
        }}
      >
        {t(locale, "book")}
      </Button>
      <h2 className="mt-8 text-xl font-semibold">{t(locale, "navMine")}</h2>
      <ul className="mt-2 grid gap-2">
        {mine.map((booking) => (
          <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            <span>
              {t(locale, `bin_${booking.binType}` as MessageKey)} · {booking.kg} kg · {formatWhen(booking.scheduledAt, locale)} · {booking.status}
            </span>
            <span className="flex gap-2">
              {booking.status === "CONFIRMED" ? (
                <Button size="sm" variant="outline" onClick={() => setLive(booking)}>
                  {t(locale, "live")}
                </Button>
              ) : null}
              {booking.status === "CONFIRMED" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await api(`/bookings/${booking.id}/cancel`, { method: "POST" }, auth.token);
                      await loadMine();
                    } catch (caught) {
                      setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
                    }
                  }}
                >
                  {t(locale, "cancelBooking")}
                </Button>
              ) : null}
              {booking.status === "COMPLETED" ? (
                <Button size="sm" variant="secondary" onClick={() => setTimes({ ...times, [booking.binType]: booking.scheduledAt })}>
                  {t(locale, "bookAgain")}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {live?.arrivalOpen ? <p className="mt-4 rounded-xl bg-secondary px-3 py-3 font-medium">{t(locale, "arrivedTitle")}</p> : null}
      {live?.shift.lastLat != null && live.shift.lastLng != null ? (
        <div className="mt-4">
          <LiveMap driver={{ lat: live.shift.lastLat, lng: live.shift.lastLng }} line={[]} stops={[]} />
        </div>
      ) : null}
    </Shell>
  );
}
