"use client";

import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Row = { id: string; binType: string; kg: number; status: string; scheduledAt: string; business: { name: string }; shift: { driver: { name: string } } };

export default function AdminBookings() {
  const { locale, token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [bin, setBin] = useState("");
  useEffect(() => {
    if (!token) return;
    const query = bin ? `?binType=${bin}` : "";
    api<{ bookings: Row[] }>(`/office/bookings${query}`, {}, token).then((body) => setRows(body.bookings));
  }, [token, bin]);
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(locale, "navBookings")}</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {["", "GREEN", "BLUE", "YELLOW", "BROWN"].map((item) => (
          <button key={item} type="button" className={`h-11 rounded-full px-4 ${bin === item ? "bg-primary text-primary-foreground" : "bg-muted"}`} onClick={() => setBin(item)}>
            {item ? t(locale, `bin_${item}` as MessageKey) : t(locale, "filters")}
          </button>
        ))}
      </div>
      <ul className="mt-6 grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-border px-4 py-4">
            <p className="text-lg">{row.business.name}</p>
            <p className="text-sm text-muted-foreground">{formatWhen(row.scheduledAt, locale)} · {row.kg} kg · {row.shift.driver.name} · {row.status}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
