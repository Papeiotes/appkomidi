"use client";

import { t, type MessageKey } from "@vardia/shared";
import { useEffect, useState } from "react";
import { MapPicker } from "@/components/maps";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Biz = { id: string; name: string; afm: string; status: string; lat: number; lng: number; addressLabel: string; user: { username: string } };
type Truck = { id: string; binType: string; capacityKg: number };
type Person = { id: string; username: string; name: string; role: string };

export default function AdminPage() {
  const auth = useRequire("ADMIN");
  const locale = auth.locale;
  const [pending, setPending] = useState<Biz[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState({ username: "", password: "", name: "", role: "DRIVER" });
  const [truck, setTruck] = useState({ binType: "GREEN", capacityKg: 500 });
  const [shift, setShift] = useState({ truckId: "", driverId: "", startsAt: "" });
  const [area, setArea] = useState<{ name: string; ring: [number, number][] }>({ name: "", ring: [] });
  const [stats, setStats] = useState<{ businessId: string; binType: string; status: string; _sum: { kg: number | null }; _count: number }[]>([]);

  async function load() {
    if (!auth.token) return;
    const [biz, fleet, users, summary] = await Promise.all([
      api<{ businesses: Biz[] }>("/admin/businesses?status=PENDING", {}, auth.token),
      api<{ trucks: Truck[] }>("/admin/trucks", {}, auth.token),
      api<{ users: Person[] }>("/admin/users", {}, auth.token),
      api<{ rows: typeof stats }>("/admin/stats", {}, auth.token),
    ]);
    setPending(biz.businesses);
    setTrucks(fleet.trucks);
    setPeople(users.users);
    setStats(summary.rows);
  }

  useEffect(() => {
    if (!auth.token) return;
    load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
  }, [auth.token]);

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{t(locale, "navAdmin")}</h1>
      <ErrorNote code={error} locale={locale} />
      <section className="mt-6">
        <h2 className="text-xl font-semibold">{t(locale, "approve")}</h2>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground">{t(locale, "empty")}</p> : null}
        <ul className="mt-2 grid gap-4">
          {pending.map((item) => (
            <li key={item.id} className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_280px]">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.user.username} · {item.afm}</p>
                <p className="text-sm">{item.addressLabel}</p>
                <Button className="mt-2" onClick={async () => { await api(`/admin/businesses/${item.id}/approve`, { method: "POST", body: "{}" }, auth.token); await load(); }}>
                  {t(locale, "approve")}
                </Button>
              </div>
              <MapPicker locale={locale} token={auth.token} lat={item.lat} lng={item.lng} onChange={() => undefined} />
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <form
          className="grid gap-2 rounded-xl border border-border p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await api("/admin/users", { method: "POST", body: JSON.stringify(account) }, auth.token);
            setAccount({ username: "", password: "", name: "", role: "DRIVER" });
            await load();
          }}
        >
          <h2 className="font-semibold">{t(locale, "createUser")}</h2>
          <Input className="h-10" placeholder={t(locale, "username")} value={account.username} onChange={(event) => setAccount({ ...account, username: event.target.value })} required />
          <Input className="h-10" placeholder={t(locale, "password")} value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} required />
          <Input className="h-10" placeholder={t(locale, "contactName")} value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} required />
          <select className="h-10 rounded-lg border px-2" value={account.role} onChange={(event) => setAccount({ ...account, role: event.target.value })}>
            <option value="DRIVER">{t(locale, "roleDriver")}</option>
            <option value="OFFICE">{t(locale, "roleOffice")}</option>
            <option value="ADMIN">{t(locale, "roleAdmin")}</option>
          </select>
          <Button type="submit">{t(locale, "save")}</Button>
        </form>
        <form
          className="grid gap-2 rounded-xl border border-border p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await api("/admin/trucks", { method: "POST", body: JSON.stringify(truck) }, auth.token);
            await load();
          }}
        >
          <h2 className="font-semibold">{t(locale, "truck")}</h2>
          <select className="h-10 rounded-lg border px-2" value={truck.binType} onChange={(event) => setTruck({ ...truck, binType: event.target.value })}>
            {["GREEN", "BLUE", "YELLOW", "BROWN"].map((item) => (
              <option key={item} value={item}>{t(locale, `bin_${item}` as MessageKey)}</option>
            ))}
          </select>
          <Input className="h-10" type="number" value={truck.capacityKg} onChange={(event) => setTruck({ ...truck, capacityKg: Number(event.target.value) })} />
          <Button type="submit">{t(locale, "save")}</Button>
          <ul className="text-sm text-muted-foreground">
            {trucks.map((item) => (
              <li key={item.id}>{item.binType} · {item.capacityKg} kg</li>
            ))}
          </ul>
        </form>
      </section>
      <form
        className="mt-4 grid gap-2 rounded-xl border border-border p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await api("/admin/shifts", { method: "POST", body: JSON.stringify({ ...shift, startsAt: new Date(shift.startsAt).toISOString() }) }, auth.token);
          setShift({ ...shift, startsAt: "" });
        }}
      >
        <h2 className="font-semibold">{t(locale, "newShift")}</h2>
        <select className="h-10 rounded-lg border px-2" value={shift.truckId} onChange={(event) => setShift({ ...shift, truckId: event.target.value })} required>
          <option value="">{t(locale, "truck")}</option>
          {trucks.map((item) => (
            <option key={item.id} value={item.id}>{item.binType} · {item.capacityKg} kg</option>
          ))}
        </select>
        <select className="h-10 rounded-lg border px-2" value={shift.driverId} onChange={(event) => setShift({ ...shift, driverId: event.target.value })} required>
          <option value="">{t(locale, "driver")}</option>
          {people.filter((person) => person.role === "DRIVER").map((person) => (
            <option key={person.id} value={person.id}>{person.name}</option>
          ))}
        </select>
        <Input className="h-10" type="datetime-local" value={shift.startsAt} onChange={(event) => setShift({ ...shift, startsAt: event.target.value })} required />
        <Button type="submit">{t(locale, "save")}</Button>
      </form>
      <section className="mt-4 rounded-xl border border-border p-3">
        <h2 className="font-semibold">{t(locale, "navAreas")}</h2>
        <p className="text-sm text-muted-foreground">{t(locale, "areaHelp")}</p>
        <Input className="mt-2 h-10" placeholder={t(locale, "subArea")} value={area.name} onChange={(event) => setArea({ ...area, name: event.target.value })} />
        <div className="mt-2">
          <MapPicker
            locale={locale}
            token={auth.token}
            lat={37.98}
            lng={23.73}
            onChange={(next) => setArea((current) => ({ ...current, ring: [...current.ring, [next.lng, next.lat]] }))}
          />
        </div>
        <p className="text-xs text-muted-foreground">{area.ring.length} vertices</p>
        <Button
          className="mt-2"
          onClick={async () => {
            await api("/admin/areas", { method: "POST", body: JSON.stringify(area) }, auth.token);
            setArea({ name: "", ring: [] });
          }}
        >
          {t(locale, "drawArea")}
        </Button>
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-semibold">{t(locale, "navStats")}</h2>
        <ul className="mt-2 text-sm">
          {stats.map((row) => (
            <li key={`${row.businessId}-${row.binType}-${row.status}`}>
              {row.binType} · {row.status} · {row._sum.kg ?? 0} kg · {row._count}
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
