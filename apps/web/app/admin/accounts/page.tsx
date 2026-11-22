"use client";

import { t, OFFICE_PERMISSIONS, type MessageKey } from "@vardia/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Person = { id: string; username: string; name: string; role: string; permissions: string[] };

const permKey: Record<string, MessageKey> = {
  "bookings.view": "perm_view",
  "bookings.reschedule": "perm_reschedule",
  "bookings.cancel": "perm_cancel",
  "bookings.question": "perm_question",
  "slots.toggle": "perm_slots",
  "stats.view": "perm_stats",
};

export default function AccountsPage() {
  const { locale, token } = useAuth();
  const [users, setUsers] = useState<Person[]>([]);
  const [editing, setEditing] = useState<Person | null>(null);
  const [step, setStep] = useState(0);
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    api<{ users: Person[] }>("/admin/users", {}, token).then((body) => setUsers(body.users));
  }, [token]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t(locale, "navAccounts")}</h1>
        <Link href="/admin/accounts/new" className="inline-flex h-12 min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white">
          {t(locale, "addAccount")}
        </Link>
      </div>
      <ul className="mt-6 grid gap-3">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between rounded-2xl border border-border px-4 py-4">
            <div>
              <p className="text-lg">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.username} · {user.role}</p>
            </div>
            {user.role === "OFFICE" ? (
              <Button variant="outline" onClick={() => { setEditing(user); setPerms(user.permissions); setStep(0); }}>
                {t(locale, "permissions")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {editing && step === 0 ? (
        <div className="mt-6 max-w-lg rounded-2xl border border-border p-5">
          <h2 className="text-xl font-semibold">{editing.name}</h2>
          <div className="mt-4 grid gap-2">
            {OFFICE_PERMISSIONS.map((permission) => (
              <label key={permission} className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3">
                <input
                  type="checkbox"
                  checked={perms.includes(permission)}
                  onChange={() =>
                    setPerms((current) =>
                      current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission],
                    )
                  }
                />
                {t(locale, permKey[permission])}
              </label>
            ))}
          </div>
          <Button className="mt-4 h-12 w-full" onClick={() => setStep(1)}>{t(locale, "review")}</Button>
        </div>
      ) : null}
      {editing && step === 1 ? (
        <div className="mt-6 max-w-lg rounded-2xl bg-secondary p-5">
          <p>{perms.map((permission) => t(locale, permKey[permission])).join(" · ")}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>{t(locale, "back")}</Button>
            <Button
              className="h-12 flex-1"
              onClick={async () => {
                await api(`/admin/users/${editing.id}/permissions`, { method: "PATCH", body: JSON.stringify({ permissions: perms }) }, token);
                setEditing(null);
                const body = await api<{ users: Person[] }>("/admin/users", {}, token);
                setUsers(body.users);
              }}
            >
              {t(locale, "save")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
