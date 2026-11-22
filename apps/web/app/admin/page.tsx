"use client";

import { t } from "@vardia/shared";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

const cards = [
  ["/admin/accounts", "navAccounts"],
  ["/admin/approvals", "navApprovals"],
  ["/admin/trucks", "navTrucks"],
  ["/admin/shifts", "navShifts"],
  ["/admin/bookings", "navBookings"],
  ["/admin/areas", "navAreas"],
  ["/admin/stats", "navStats"],
] as const;

export default function AdminHome() {
  const { locale } = useAuth();
  return (
    <div>
      <h1 className="text-3xl font-semibold">{t(locale, "navHome")}</h1>
      <p className="mt-2 text-muted-foreground">Δήμος Αθηναίων</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {cards.map(([href, key]) => (
          <Link key={href} href={href} className="rounded-2xl border border-border px-5 py-6 text-lg hover:border-primary">
            {t(locale, key)}
          </Link>
        ))}
      </div>
    </div>
  );
}
