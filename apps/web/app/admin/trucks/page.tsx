"use client";

import { t, type MessageKey } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { binColor } from "@/components/wizard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Truck = { id: string; binType: string; capacityKg: number; plate: string };

export default function TrucksPage() {
  const { locale, token } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  useEffect(() => {
    if (token) api<{ trucks: Truck[] }>("/admin/trucks", {}, token).then((body) => setTrucks(body.trucks));
  }, [token]);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t(locale, "navTrucks")}</h1>
        <Button className="h-12" render={<Link href="/admin/trucks/new" />}>{t(locale, "next")}</Button>
      </div>
      <ul className="mt-6 grid gap-3">
        {trucks.map((truck) => (
          <li key={truck.id} className="flex items-center gap-3 rounded-2xl border border-border px-4 py-4">
            <span className="h-4 w-4 rounded-full" style={{ background: binColor[truck.binType] }} />
            <span className="text-lg">{truck.plate || "—"}</span>
            <span className="text-muted-foreground">{t(locale, `bin_${truck.binType}` as MessageKey)} · {truck.capacityKg} kg</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
