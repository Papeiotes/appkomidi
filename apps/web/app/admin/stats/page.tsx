"use client";

import { t } from "@vardia/shared";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Row = { businessId: string; binType: string; status: string; _sum: { kg: number | null }; _count: number };
type Biz = { id: string; name: string };

export default function StatsPage() {
  const { locale, token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!token) return;
    api<{ rows: Row[]; businesses: Biz[] }>("/admin/stats", {}, token).then((body) => {
      setRows(body.rows);
      setNames(Object.fromEntries(body.businesses.map((business) => [business.id, business.name])));
    });
  }, [token]);
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(locale, "navStats")}</h1>
      <ul className="mt-6 grid gap-3">
        {rows.map((row) => (
          <li key={`${row.businessId}-${row.binType}-${row.status}`} className="rounded-2xl border border-border px-4 py-4">
            <p className="text-lg">{names[row.businessId] ?? row.businessId}</p>
            <p className="text-sm text-muted-foreground">{row.binType} · {row.status} · {row._sum.kg ?? 0} kg</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
