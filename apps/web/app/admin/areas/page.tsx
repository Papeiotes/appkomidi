"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AreasPage() {
  const { locale, token } = useAuth();
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (token) api<{ areas: { id: string; name: string }[] }>("/admin/areas", {}, token).then((body) => setAreas(body.areas));
  }, [token]);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t(locale, "navAreas")}</h1>
        <Link href="/admin/areas/new" className="inline-flex h-12 min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white">{t(locale, "next")}</Link>
      </div>
      <ul className="mt-6 grid gap-3">
        {areas.map((area) => (
          <li key={area.id} className="rounded-2xl border border-border px-4 py-5 text-lg">{area.name}</li>
        ))}
      </ul>
    </div>
  );
}
