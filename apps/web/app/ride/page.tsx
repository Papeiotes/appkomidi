"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Capacity, StatusBadge, When } from "@/components/bits";
import { MapPicker } from "@/components/maps";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, type Shift } from "@/lib/api";
import { useRequire } from "@/lib/auth";

export default function RidePage() {
  const auth = useRequire("EMPLOYEE");
  const locale = auth.locale;
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [custom, setCustom] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number; label?: string } | null>(null);

  async function load() {
    if (!auth.token) return;
    const body = await api<{ shifts: Shift[] }>("/shifts/available", {}, auth.token);
    setShifts(body.shifts);
  }

  useEffect(() => {
    if (!auth.token) return;
    load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  return (
    <Shell>
      <h1 className="font-serif text-4xl">{t(locale, "navBook")}</h1>
      <ErrorNote code={error} locale={locale} />
      {shifts.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t(locale, "emptyShifts")}</p> : null}
      <ul className="mt-4 grid gap-3">
        {shifts.map((shift) => {
          const active = openId === shift.id;
          const point = shift.direction === "TO_WORK" ? shift.muster : shift.destination;
          return (
            <li key={shift.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{shift.title}</p>
                  <p className="text-sm text-muted-foreground">
                    <When iso={shift.departsAt} locale={locale} /> · {shift.driver?.name ?? t(locale, "unassigned")}
                  </p>
                </div>
                <StatusBadge kind="status" status={shift.status} locale={locale} />
              </div>
              <div className="mt-3">
                <Capacity shift={shift} locale={locale} />
              </div>
              {shift.myBooking ? (
                <div className="mt-3 flex gap-2">
                  <Button render={<Link href={`/ride/${shift.id}`} />}>{t(locale, "track")}</Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await api(`/bookings/${shift.myBooking!.id}/cancel`, { method: "POST" }, auth.token);
                        toast.success(t(locale, "cancelBooking"));
                        await load();
                      } catch (caught) {
                        setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
                      }
                    }}
                  >
                    {t(locale, "cancelBooking")}
                  </Button>
                </div>
              ) : (
                <div className="mt-3 grid gap-2">
                  <Button variant="outline" onClick={() => setOpenId(active ? null : shift.id)} disabled={!shift.bookable}>
                    {shift.bookable ? t(locale, "book") : shift.remainingSeats === 0 ? t(locale, "full") : t(locale, "locked")}
                  </Button>
                  {active ? (
                    <form
                      className="grid gap-2"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        try {
                          await api(
                            "/bookings",
                            {
                              method: "POST",
                              body: JSON.stringify({
                                shiftId: shift.id,
                                seats,
                                pickupLat: custom && pin ? pin.lat : undefined,
                                pickupLng: custom && pin ? pin.lng : undefined,
                                pickupLabel: custom && pin?.label ? pin.label : undefined,
                              }),
                            },
                            auth.token,
                          );
                          toast.success(t(locale, "bookedOk"));
                          setOpenId(null);
                          await load();
                        } catch (caught) {
                          setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
                        }
                      }}
                    >
                      <label className="grid gap-1 text-sm">
                        {t(locale, "seatsRequested")}
                        <Input className="h-10" type="number" min={1} max={4} value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={custom} onChange={(event) => setCustom(event.target.checked)} />
                        {t(locale, "customPin")}
                      </label>
                      {custom ? (
                        <MapPicker
                          locale={locale}
                          token={auth.token}
                          lat={pin?.lat ?? point.lat}
                          lng={pin?.lng ?? point.lng}
                          onChange={setPin}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t(locale, "defaultPoint")}: {point.label}
                        </p>
                      )}
                      <Button type="submit">{t(locale, "book")}</Button>
                    </form>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
