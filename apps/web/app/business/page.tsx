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
import { Label } from "@/components/ui/label";
import { ApiError, api, type Shift } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Business = {
  id: string;
  name: string;
  taxId: string | null;
  address: string;
  lat: number;
  lng: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  inviteCode: string;
  rejectionNote: string | null;
};

type Vehicle = { id: string; plate: string; seats: number; label: string | null };

export default function BusinessPage() {
  const auth = useRequire("BUSINESS_OWNER");
  const locale = auth.locale;
  const [business, setBusiness] = useState<Business | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [plate, setPlate] = useState("");
  const [seats, setSeats] = useState(8);
  const [label, setLabel] = useState("");

  async function load() {
    if (!auth.token) return;
    const [biz, list, fleet] = await Promise.all([
      api<{ business: Business }>("/business", {}, auth.token),
      api<{ shifts: Shift[] }>("/business/shifts", {}, auth.token),
      api<{ vehicles: Vehicle[] }>("/business/vehicles", {}, auth.token),
    ]);
    setBusiness(biz.business);
    setShifts(list.shifts);
    setVehicles(fleet.vehicles);
  }

  useEffect(() => {
    if (!auth.token) return;
    load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  if (!auth.user || !business) {
    return (
      <Shell>
        <p>{error ? null : t(locale, "loading")}</p>
        <ErrorNote code={error} locale={locale} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{business.name}</p>
          <h1 className="font-serif text-4xl">{t(locale, "overviewTitle")}</h1>
        </div>
        <StatusBadge kind="business" status={business.status} locale={locale} />
      </div>
      <ErrorNote code={error} locale={locale} />
      {business.status !== "APPROVED" ? (
        <section className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-serif text-2xl">{business.status === "REJECTED" ? t(locale, "rejectedTitle") : t(locale, "pendingTitle")}</h2>
          <p className="text-sm text-muted-foreground">{business.rejectionNote || t(locale, "pendingBody")}</p>
          <MapPicker
            locale={locale}
            token={auth.token}
            lat={business.lat}
            lng={business.lng}
            onChange={(next) =>
              setBusiness({ ...business, lat: next.lat, lng: next.lng, address: next.label ?? business.address })
            }
          />
          <Button
            onClick={async () => {
              try {
                const body = await api<{ business: Business }>(
                  "/business",
                  {
                    method: "PATCH",
                    body: JSON.stringify({
                      address: business.address,
                      lat: business.lat,
                      lng: business.lng,
                      resubmit: business.status === "REJECTED",
                    }),
                  },
                  auth.token,
                );
                setBusiness(body.business);
                toast.success(t(locale, "saved"));
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
              }
            }}
          >
            {business.status === "REJECTED" ? t(locale, "resubmit") : t(locale, "save")}
          </Button>
        </section>
      ) : (
        <>
          <section className="mt-4 rounded-2xl border border-border bg-card p-4">
            <h2 className="font-medium">{t(locale, "inviteTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(locale, "inviteHelp")}</p>
            <p className="mt-2 font-serif text-3xl tracking-widest">{business.inviteCode}</p>
          </section>
          <section className="mt-4 grid gap-4 md:grid-cols-[1fr_.8fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-2xl">{t(locale, "navShifts")}</h2>
                <Button render={<Link href="/business/shifts/new" />}>{t(locale, "newShift")}</Button>
              </div>
              {shifts.length === 0 ? <p className="text-sm text-muted-foreground">{t(locale, "emptyShifts")}</p> : null}
              <ul className="grid gap-3">
                {shifts.map((shift) => (
                  <li key={shift.id}>
                    <Link href={`/business/shifts/${shift.id}`} className="block rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{shift.title}</p>
                          <p className="text-sm text-muted-foreground">
                            <When iso={shift.departsAt} locale={locale} /> · {t(locale, shift.direction === "TO_WORK" ? "toWork" : "fromWork")}
                          </p>
                        </div>
                        <StatusBadge kind="status" status={shift.status} locale={locale} />
                      </div>
                      <div className="mt-3">
                        <Capacity shift={shift} locale={locale} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <form
              className="h-fit rounded-2xl border border-border bg-card p-4"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  await api("/business/vehicles", { method: "POST", body: JSON.stringify({ plate, seats, label }) }, auth.token);
                  setPlate("");
                  setLabel("");
                  await load();
                } catch (caught) {
                  setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
                }
              }}
            >
              <h2 className="font-serif text-2xl">{t(locale, "addVehicle")}</h2>
              <div className="mt-3 grid gap-2">
                <Label>{t(locale, "plate")}</Label>
                <Input className="h-10" value={plate} onChange={(event) => setPlate(event.target.value)} required />
                <Label>{t(locale, "seats")}</Label>
                <Input className="h-10" type="number" min={1} value={seats} onChange={(event) => setSeats(Number(event.target.value))} required />
                <Label>{t(locale, "label")}</Label>
                <Input className="h-10" value={label} onChange={(event) => setLabel(event.target.value)} />
                <Button type="submit">{t(locale, "save")}</Button>
              </div>
              <ul className="mt-4 grid gap-2 text-sm">
                {vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="flex items-center justify-between">
                    <span>
                      {vehicle.plate} · {vehicle.seats}
                    </span>
                    <button
                      type="button"
                      className="text-destructive"
                      onClick={async () => {
                        try {
                          await api(`/business/vehicles/${vehicle.id}`, { method: "DELETE" }, auth.token);
                          await load();
                        } catch (caught) {
                          setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
                        }
                      }}
                    >
                      {t(locale, "delete")}
                    </button>
                  </li>
                ))}
              </ul>
            </form>
          </section>
        </>
      )}
    </Shell>
  );
}
