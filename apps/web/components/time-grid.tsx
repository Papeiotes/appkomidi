"use client";

import { athensParts, t, type Locale } from "@vardia/shared";

export type TimeSlot = { at: string; bookable: boolean };

function clock(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", {
    timeZone: "Europe/Athens",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function part(iso: string) {
  const hour = athensParts(new Date(iso)).hour;
  if (hour < 12) return "morning" as const;
  if (hour < 17) return "midday" as const;
  return "evening" as const;
}

export function TimeGrid({
  slots,
  suggested,
  value,
  onChange,
  locale,
}: {
  slots: TimeSlot[];
  suggested: string | null;
  value: string;
  onChange: (at: string) => void;
  locale: Locale;
}) {
  const open = slots.filter((slot) => slot.bookable);
  const groups = (["morning", "midday", "evening"] as const)
    .map((key) => ({
      key,
      items: open.filter((slot) => part(slot.at) === key && slot.at !== suggested),
    }))
    .filter((group) => group.items.length > 0);
  const featured = suggested && open.some((slot) => slot.at === suggested) ? suggested : null;

  if (!open.length) return <p className="text-base text-muted-foreground">{t(locale, "empty")}</p>;

  return (
    <div className="grid gap-6">
      {featured ? (
        <button
          type="button"
          onClick={() => onChange(featured)}
          className={`flex min-h-16 w-full items-center justify-between rounded-2xl px-4 text-left ${value === featured ? "bg-primary text-white" : "border-2 border-primary bg-secondary text-foreground"}`}
        >
          <span className="text-xl font-semibold">{clock(featured, locale)}</span>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${value === featured ? "bg-white/20" : "bg-primary text-white"}`}>
            {t(locale, "suggestedBadge")}
          </span>
        </button>
      ) : null}
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-3 text-base font-medium text-muted-foreground">{t(locale, group.key)}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {group.items.map((slot) => {
              const on = value === slot.at;
              return (
                <button
                  key={slot.at}
                  type="button"
                  onClick={() => onChange(slot.at)}
                  className={`min-h-14 rounded-2xl border text-base font-semibold ${on ? "border-primary bg-primary text-white" : "border-border bg-white"}`}
                >
                  {clock(slot.at, locale)}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
