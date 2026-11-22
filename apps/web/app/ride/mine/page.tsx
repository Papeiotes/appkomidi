"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge, When } from "@/components/bits";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api, type BookingRow } from "@/lib/api";
import { useRequire } from "@/lib/auth";

export default function MyRidesPage() {
  const auth = useRequire("EMPLOYEE");
  const locale = auth.locale;
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  useEffect(() => {
    if (!auth.token) return;
    api<{ bookings: BookingRow[] }>("/bookings/mine", {}, auth.token).then((body) => setBookings(body.bookings));
  }, [auth.token]);

  return (
    <Shell>
      <h1 className="font-serif text-4xl">{t(locale, "navMyRides")}</h1>
      {bookings.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t(locale, "emptyBookings")}</p> : null}
      <ul className="mt-4 grid gap-3">
        {bookings.map((booking) => (
          <li key={booking.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="font-medium">{booking.shift?.title}</p>
              <p className="text-sm text-muted-foreground">{booking.shift ? <When iso={booking.shift.departsAt} locale={locale} /> : null}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge kind="booking" status={booking.status} locale={locale} />
              {booking.shift && booking.status === "CONFIRMED" ? (
                <Button size="sm" render={<Link href={`/ride/${booking.shift.id}`} />}>
                  {t(locale, "track")}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
