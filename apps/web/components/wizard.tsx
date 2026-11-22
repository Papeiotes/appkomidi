"use client";

import { t } from "@vardia/shared";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export function Wizard({
  step,
  total,
  title,
  children,
  onBack,
  onNext,
  nextLabel,
  canNext = true,
  wide = false,
}: {
  step: number;
  total: number;
  title: string;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  canNext?: boolean;
  wide?: boolean;
}) {
  const { locale } = useAuth();
  return (
    <div className={`mx-auto flex min-h-[70vh] w-full max-w-lg flex-col ${wide ? "lg:max-w-3xl" : ""}`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {step + 1} / {total}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-8 flex-1">{children}</div>
      <div className="mt-8 flex gap-3">
        {onBack ? (
          <button type="button" className="inline-flex h-12 min-h-11 items-center justify-center rounded-xl border border-border bg-white px-5 text-base font-medium" onClick={onBack}>
            {t(locale, "back")}
          </button>
        ) : null}
        <button type="button" className="inline-flex h-12 min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-white disabled:opacity-50" disabled={!canNext} onClick={onNext}>
          {nextLabel ?? t(locale, "next")}
        </button>
      </div>
    </div>
  );
}

export const binColor: Record<string, string> = {
  GREEN: "#1b7f4a",
  BLUE: "#2b6cb0",
  YELLOW: "#e0b400",
  BROWN: "#8a5a3b",
};

export function ChoiceGrid({
  options,
  value,
  onChange,
  multiple,
}: {
  options: { id: string; label: string; color?: string }[];
  value: string | string[];
  onChange: (id: string) => void;
  multiple?: boolean;
}) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left text-lg ${on ? "border-primary bg-secondary" : "border-border bg-white"}`}
          >
            {option.color ? <span className="h-5 w-5 rounded-full" style={{ background: option.color }} /> : null}
            <span>{option.label}</span>
            {multiple && on ? <span className="ml-auto text-primary">✓</span> : null}
          </button>
        );
      })}
    </div>
  );
}
