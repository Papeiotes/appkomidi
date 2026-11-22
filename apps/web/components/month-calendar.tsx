"use client";

import type { Locale } from "@vardia/shared";

const weekEl = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];
const weekEn = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthsBetween(start: string, end: string) {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const months: { year: number; month: number }[] = [];
  let year = sy;
  let month = sm;
  while (year < ey || (year === ey && month <= em)) {
    months.push({ year, month });
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function MonthCalendar({
  days,
  value,
  onChange,
  locale,
}: {
  days: string[];
  value: string;
  onChange: (day: string) => void;
  locale: Locale;
}) {
  if (!days.length) return null;
  const enabled = new Set(days);
  const months = monthsBetween(days[0], days[days.length - 1]);
  const week = locale === "el" ? weekEl : weekEn;
  return (
    <div className="grid gap-6">
      {months.map(({ year, month }) => {
        const first = new Date(Date.UTC(year, month - 1, 1));
        const lead = (first.getUTCDay() + 6) % 7;
        const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const title = new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(first);
        const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`)];
        return (
          <div key={`${year}-${month}`}>
            <p className="mb-3 text-center text-lg font-medium capitalize">{title}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {week.map((label) => (
                <div key={label} className="py-1">{label}</div>
              ))}
              {cells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} />;
                const open = enabled.has(day);
                const selected = day === value;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!open}
                    onClick={() => onChange(day)}
                    className={`h-11 rounded-full text-sm ${selected ? "bg-primary font-semibold text-white" : open ? "text-foreground hover:bg-secondary" : "cursor-default text-muted-foreground/40"}`}
                  >
                    {Number(day.slice(-2))}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
