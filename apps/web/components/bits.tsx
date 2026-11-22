"use client";

import { formatWhen, t, type Locale, type MessageKey } from "@vardia/shared";
import { Badge } from "@/components/ui/badge";
import type { Shift } from "@/lib/api";

export function StatusBadge({
  kind,
  status,
  locale,
}: {
  kind: "status" | "business" | "booking";
  status: string;
  locale: Locale;
}) {
  const key = `${kind}_${status}` as MessageKey;
  const variant = status === "CANCELLED" || status === "REJECTED" || status === "NO_SHOW" ? "destructive" : "secondary";
  return <Badge variant={variant}>{t(locale, key)}</Badge>;
}

export function Capacity({ shift, locale }: { shift: Pick<Shift, "confirmedSeats" | "capacity" | "remainingSeats">; locale: Locale }) {
  const width = Math.min(100, (shift.confirmedSeats / Math.max(1, shift.capacity)) * 100);
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {shift.confirmedSeats}/{shift.capacity}
        </span>
        <span>{t(locale, "seatsLeftCount", { n: shift.remainingSeats })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function When({ iso, locale }: { iso: string; locale: Locale }) {
  return <span>{formatWhen(iso, locale)}</span>;
}
