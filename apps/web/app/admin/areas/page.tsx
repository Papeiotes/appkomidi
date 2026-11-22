"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
        <Button className="h-12" render={<Link href="/admin/areas/new" />}>{t(locale, "next")}</Button>
      </div>
      <ul className="mt-6 grid gap-3">
        {areas.map((area) => (
          <li key={area.id} className="rounded-2xl border border-border px-4 py-5 text-lg">{area.name}</li>
        ))}
      </ul>
    </div>
  );
}
