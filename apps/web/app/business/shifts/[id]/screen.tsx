"use client";

import { t } from "@vardia/shared";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Capacity, StatusBadge, When } from "@/components/bits";
import { LiveMap } from "@/components/maps";
import { ShiftForm, toLocalInput, type ShiftDraft } from "@/components/shift-form";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, type BookingRow, type Shift } from "@/lib/api";
import { useRequire } from "@/lib/auth";

export default function ShiftDetailPage() {
  const auth = useRequire("BUSINESS_OWNER");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const locale = auth.locale;
  const [shift, setShift] = useState<Shift | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; seats: number; label: string | null }[]>([]);
  const [fallback, setFallback] = useState({ lat: 37.98, lng: 23.72, label: "Έδρα" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [duplicateAt, setDuplicateAt] = useState("");

  async function load() {
    if (!auth.token) return;
    const [detail, fleet, biz] = await Promise.all([
      api<{ shift: Shift; bookings: BookingRow[] }>(`/business/shifts/${params.id}`, {}, auth.token),
      api<{ vehicles: { id: string; plate: string; seats: number; label: string | null }[] }>("/business/vehicles", {}, auth.token),
      api<{ business: { lat: number; lng: number; address: string } }>("/business", {}, auth.token),
    ]);
    setShift(detail.shift);
    setBookings(detail.bookings);
    setVehicles(fleet.vehicles);
    setFallback({ lat: biz.business.lat, lng: biz.business.lng, label: biz.business.address });
    setDuplicateAt(toLocalInput(detail.shift.departsAt));
  }

  useEffect(() => {
    if (!auth.token) return;
    load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, params.id]);

  if (!shift || !auth.token) {
    return (
      <Shell>
        <p>{t(locale, "loading")}</p>
        <ErrorNote code={error} locale={locale} />
      </Shell>
    );
  }

  const line: [number, number][] = [
    [shift.muster.lat, shift.muster.lng],
    ...bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => [booking.pickup.lat, booking.pickup.lng] as [number, number]),
    [shift.destination.lat, shift.destination.lng],
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">{shift.title}</h1>
          <p className="text-sm text-muted-foreground">
            <When iso={shift.departsAt} locale={locale} />
          </p>
        </div>
        <StatusBadge kind="status" status={shift.status} locale={locale} />
      </div>
      <div className="mt-3 max-w-sm">
        <Capacity shift={shift} locale={locale} />
      </div>
      <ErrorNote code={error} locale={locale} />
      <div className="mt-4">
        <LiveMap
          driver={shift.location}
          line={line}
          stops={bookings.map((booking) => ({ ...booking.pickup, label: booking.rider?.name ?? booking.pickup.label }))}
        />
      </div>
      <h2 className="mt-6 font-serif text-2xl">{t(locale, "passengers")}</h2>
      {bookings.length === 0 ? <p className="text-sm text-muted-foreground">{t(locale, "emptyPassengers")}</p> : null}
      <ul className="mt-2 grid gap-2">
        {bookings.map((booking) => (
          <li key={booking.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <span>
              {booking.rider?.name} · {booking.seats} · {booking.pickup.label}
            </span>
            <StatusBadge kind="booking" status={booking.status} locale={locale} />
          </li>
        ))}
      </ul>
      {shift.status === "DRAFT" || shift.status === "OPEN" || shift.status === "LOCKED" ? (
        <div className="mt-6">
          <ShiftForm
            locale={locale}
            token={auth.token}
            vehicles={vehicles}
            initial={shift}
            fallback={fallback}
            pending={pending}
            onSubmit={async (draft: ShiftDraft) => {
              setPending(true);
              try {
                await api(`/business/shifts/${shift.id}`, { method: "PATCH", body: JSON.stringify(draft) }, auth.token);
                await load();
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
              } finally {
                setPending(false);
              }
            }}
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          {t(locale, "duplicate")}
          <Input className="h-10" type="datetime-local" value={duplicateAt} onChange={(event) => setDuplicateAt(event.target.value)} />
        </label>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const body = await api<{ shift: Shift }>(
                `/business/shifts/${shift.id}/duplicate`,
                { method: "POST", body: JSON.stringify({ departsAt: new Date(duplicateAt).toISOString() }) },
                auth.token,
              );
              router.push(`/business/shifts/${body.shift.id}`);
            } catch (caught) {
              setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
            }
          }}
        >
          {t(locale, "duplicate")}
        </Button>
        <Button
          variant="destructive"
          onClick={async () => {
            if (!confirm(t(locale, "confirmCancelShift"))) return;
            try {
              await api(`/business/shifts/${shift.id}/cancel`, { method: "POST" }, auth.token);
              await load();
            } catch (caught) {
              setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
            }
          }}
        >
          {t(locale, "cancelShift")}
        </Button>
      </div>
    </Shell>
  );
}
