"use client";

import { t } from "@vardia/shared";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/bits";
import { MapPicker } from "@/components/maps";
import { ErrorNote, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { useRequire } from "@/lib/auth";

type Business = {
  id: string;
  name: string;
  taxId: string | null;
  address: string;
  lat: number;
  lng: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  inviteCode: string;
  rejectionNote: string | null;
  owner: { name: string; email: string; phone: string | null };
};

export default function AdminPage() {
  const auth = useRequire("ADMIN");
  const locale = auth.locale;
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rows, setRows] = useState<Business[]>([]);
  const [stats, setStats] = useState({ pendingBusinesses: 0, openShifts: 0, liveShifts: 0 });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load(next = status) {
    if (!auth.token) return;
    const [list, summary] = await Promise.all([
      api<{ businesses: Business[] }>(`/admin/businesses?status=${next}`, {}, auth.token),
      api<typeof stats>("/admin/stats", {}, auth.token),
    ]);
    setRows(list.businesses);
    setStats(summary);
  }

  useEffect(() => {
    if (!auth.token) return;
    load().catch((caught) => setError(caught instanceof ApiError ? caught.code : "REQUEST_FAILED"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, status]);

  return (
    <Shell>
      <h1 className="font-serif text-4xl">{t(locale, "approvalsTitle")}</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          [t(locale, "statsPending"), stats.pendingBusinesses],
          [t(locale, "statsOpen"), stats.openShifts],
          [t(locale, "statsLive"), stats.liveShifts],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-serif text-4xl">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((item) => (
          <Button key={item} variant={status === item ? "default" : "outline"} onClick={() => setStatus(item)}>
            {t(locale, item === "PENDING" ? "business_PENDING" : item === "APPROVED" ? "business_APPROVED" : "business_REJECTED")}
          </Button>
        ))}
      </div>
      <ErrorNote code={error} locale={locale} />
      {rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t(locale, "emptyPending")}</p> : null}
      <ul className="mt-4 grid gap-4">
        {rows.map((business) => (
          <li key={business.id} className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_280px]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-2xl">{business.name}</h2>
                <StatusBadge kind="business" status={business.status} locale={locale} />
              </div>
              <p className="text-sm text-muted-foreground">
                {business.owner.name} · {business.owner.email}
                {business.taxId ? ` · ${business.taxId}` : ""}
              </p>
              <p className="mt-2 text-sm">{business.address}</p>
              {business.status === "PENDING" ? (
                <div className="mt-3 grid gap-2">
                  <Textarea
                    placeholder={t(locale, "rejectNote")}
                    value={notes[business.id] ?? ""}
                    onChange={(event) => setNotes({ ...notes, [business.id]: event.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        await api(`/admin/businesses/${business.id}/approve`, { method: "POST" }, auth.token);
                        await load();
                      }}
                    >
                      {t(locale, "approve")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await api(
                          `/admin/businesses/${business.id}/reject`,
                          { method: "POST", body: JSON.stringify({ note: notes[business.id] ?? "" }) },
                          auth.token,
                        );
                        await load();
                      }}
                    >
                      {t(locale, "reject")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <MapPicker locale={locale} token={auth.token} lat={business.lat} lng={business.lng} onChange={() => undefined} />
          </li>
        ))}
      </ul>
    </Shell>
  );
}
