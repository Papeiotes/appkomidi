"use client";

import { t } from "@vardia/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShiftForm, type ShiftDraft } from "@/components/shift-form";
import { ErrorNote, Shell } from "@/components/shell";
import { ApiError, api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

export default function NewShiftPage() {
  const auth = useRequire("BUSINESS_OWNER");
  const router = useRouter();
  const locale = auth.locale;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fallback, setFallback] = useState({ lat: 37.9838, lng: 23.7275, label: "Έδρα" });
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; seats: number; label: string | null }[]>([]);

  useEffect(() => {
    if (!auth.token) return;
    Promise.all([
      api<{ business: { lat: number; lng: number; address: string } }>("/business", {}, auth.token),
      api<{ vehicles: { id: string; plate: string; seats: number; label: string | null }[] }>("/business/vehicles", {}, auth.token),
    ])
      .then(([biz, fleet]) => {
        setFallback({ lat: biz.business.lat, lng: biz.business.lng, label: biz.business.address });
        setVehicles(fleet.vehicles);
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
  }, [auth.token]);

  async function submit(draft: ShiftDraft) {
    if (!auth.token) return;
    setPending(true);
    setError(null);
    try {
      const body = await api<{ shift: { id: string } }>("/business/shifts", { method: "POST", body: JSON.stringify(draft) }, auth.token);
      router.push(`/business/shifts/${body.shift.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED");
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell>
      <h1 className="mb-4 font-serif text-4xl">{t(locale, "newShift")}</h1>
      <ErrorNote code={error} locale={locale} />
      {auth.token ? (
        <ShiftForm locale={locale} token={auth.token} vehicles={vehicles} fallback={fallback} pending={pending} onSubmit={submit} />
      ) : null}
    </Shell>
  );
}
