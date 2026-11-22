import { HORIZON_DAYS, athensDateKey, athensDatePlus, athensParts, formatWhen, t, type Locale, type MessageKey } from "@vardia/shared";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogoutButton } from "../src/logout";
import { useSession } from "../src/session";
import { colors, styles } from "../src/theme";

const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;
type Slot = { at: string; bookable: boolean };

function kilosOf(value: string) {
  const kilos = Number(value);
  return Number.isInteger(kilos) && kilos >= 1 && kilos <= 2000 ? kilos : 0;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function DayCalendar({ days, value, onChange, locale }: { days: string[]; value: string; onChange: (day: string) => void; locale: Locale }) {
  const enabled = new Set(days);
  const sorted = [...days].sort();
  const week = locale === "el" ? ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  if (!sorted.length) return <Text style={styles.muted}>{t(locale, "noShiftDay")}</Text>;
  const [sy, sm] = sorted[0].split("-").map(Number);
  const [ey, em] = sorted[sorted.length - 1].split("-").map(Number);
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
  return (
    <View style={{ gap: 18 }}>
      {months.map((item) => {
        const first = new Date(Date.UTC(item.year, item.month - 1, 1));
        const lead = (first.getUTCDay() + 6) % 7;
        const count = new Date(Date.UTC(item.year, item.month, 0)).getUTCDate();
        const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, index) => `${item.year}-${pad(item.month)}-${pad(index + 1)}`)];
        const title = new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
        return (
          <View key={`${item.year}-${item.month}`}>
            <Text style={{ textAlign: "center", fontSize: 18, fontWeight: "600", marginBottom: 8, textTransform: "capitalize" }}>{title}</Text>
            <View style={{ flexDirection: "row" }}>
              {week.map((label) => <Text key={label} style={{ width: "14.28%", textAlign: "center", color: colors.muted }}>{label}</Text>)}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((day, index) => {
                if (!day) return <View key={`empty-${index}`} style={{ width: "14.28%", height: 44 }} />;
                const open = enabled.has(day);
                const selected = day === value;
                return (
                  <Pressable key={day} disabled={!open} onPress={() => onChange(day)} style={{ width: "14.28%", height: 44, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: selected ? "700" : "500", color: selected ? "#fff" : open ? colors.ink : "#c5d0ca", backgroundColor: selected ? colors.olive : "transparent", overflow: "hidden", borderRadius: 22, width: 36, height: 36, textAlign: "center", lineHeight: 36 }}>{Number(day.slice(-2))}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
const hit = { top: 8, bottom: 8, left: 8, right: 8 };

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

export default function BookScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [kgByBin, setKgByBin] = useState<Record<string, string>>({});
  const [lastKg, setLastKg] = useState<Record<string, number>>({});
  const [day, setDay] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  useEffect(() => {
    if (!session.token) return;
    session.api<{ bookings: { binType: string; kg: number }[] }>("/bookings/mine").then((body) => {
      const next: Record<string, number> = {};
      for (const row of body.bookings) if (next[row.binType] == null) next[row.binType] = row.kg;
      setLastKg(next);
    }).catch(() => undefined);
  }, [session.token]);
  useEffect(() => {
    if (!session.token || picked.length === 0) return;
    const horizon = Array.from({ length: HORIZON_DAYS }, (_, index) => athensDatePlus(index));
    Promise.all(picked.map((item) => session.api<{ slots: Slot[] }>(`/slots?binType=${item}`))).then((bodies) => {
      const sets = bodies.map((body) => new Set(body.slots.map((slot) => athensDateKey(new Date(slot.at)))));
      const [first, ...rest] = sets;
      const open = horizon.filter((item) => Boolean(first?.has(item) && rest.every((set) => set.has(item))));
      setDays(open);
      setDay((current) => (open.includes(current) ? current : ""));
    }).catch(() => setDays([]));
  }, [session.token, picked]);
  const total = 2 + picked.length * 2 + 1;
  const afterDay = step - 2;
  const binPair = Math.floor(afterDay / 2);
  const phase = step === 0 ? "bin" : step === 1 ? "day" : binPair >= picked.length ? "review" : afterDay % 2 === 0 ? "kg" : "time";
  const bin = picked[binPair] ?? "";

  useEffect(() => {
    if (phase !== "time" || !bin || !day || !kilosOf(kgByBin[bin] ?? "")) return;
    session.api<{ slots: Slot[]; suggested: string | null }>(`/slots?binType=${bin}&kg=${kgByBin[bin]}`).then((body) => {
      setSlots(body.slots.filter((slot) => athensDateKey(new Date(slot.at)) === day));
      setSuggested(body.suggested && athensDateKey(new Date(body.suggested)) === day ? body.suggested : null);
    });
  }, [phase, bin, day, kgByBin]);
  useEffect(() => {
    if (phase !== "kg" || !bin || kgByBin[bin] || !lastKg[bin]) return;
    setKgByBin((current) => ({ ...current, [bin]: String(lastKg[bin]) }));
  }, [phase, bin, lastKg, kgByBin]);

  const open = slots.filter((slot) => slot.bookable);
  const groups = (["morning", "midday", "evening"] as const)
    .map((key) => ({ key, items: open.filter((slot) => part(slot.at) === key && slot.at !== suggested) }))
    .filter((group) => group.items.length > 0);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: t(locale, "bookCta"), headerRight: () => <LogoutButton /> }} />
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={{ height: 6, backgroundColor: "#f4f7f5", borderRadius: 99 }}>
          <View style={{ height: 6, width: `${((step + 1) / Math.max(total, 1)) * 100}%`, backgroundColor: colors.olive, borderRadius: 99 }} />
        </View>
        <Text style={[styles.title, { marginTop: 16, fontSize: 28 }]}>
          {phase === "bin" ? t(locale, "pickBin") : phase === "day" ? t(locale, "pickDay") : phase === "kg" ? t(locale, "pickKg") : phase === "time" ? t(locale, "pickTime") : t(locale, "review")}
        </Text>
        {phase === "kg" || phase === "time" ? <Text style={styles.muted}>{t(locale, `bin_${bin}` as MessageKey)}</Text> : null}
        {phase === "bin" ? bins.map((item) => (
          <Pressable key={item} hitSlop={hit} style={[styles.card, { minHeight: 56, justifyContent: "center" }, picked.includes(item) && { borderColor: colors.olive, backgroundColor: "#e7f6ee" }]} onPress={() => setPicked((current) => current.includes(item) ? current.filter((id) => id !== item) : [...current, item])}>
            <Text style={{ fontSize: 18 }}>{t(locale, `bin_${item}` as MessageKey)}</Text>
          </Pressable>
        )) : null}
        {phase === "day" ? <DayCalendar days={days} value={day} onChange={setDay} locale={locale} /> : null}
        {phase === "kg" ? (
          <View>
            <Text style={styles.muted}>{t(locale, "typeKg")}</Text>
            {lastKg[bin] ? (
              <Pressable hitSlop={hit} style={[styles.ghost, { minHeight: 48, marginTop: 8, justifyContent: "center" }]} onPress={() => setKgByBin((current) => ({ ...current, [bin]: String(lastKg[bin]) }))}>
                <Text style={{ color: colors.olive, fontWeight: "600" }}>{t(locale, "lastKg")} · {lastKg[bin]} kg</Text>
              </Pressable>
            ) : null}
            <TextInput keyboardType="number-pad" style={[styles.input, { marginTop: 12, fontSize: 28, minHeight: 64 }]} value={kgByBin[bin] ?? ""} onChangeText={(value) => setKgByBin((current) => ({ ...current, [bin]: value.replace(/[^0-9]/g, "") }))} />
          </View>
        ) : null}
        {phase === "time" && suggested && open.some((slot) => slot.at === suggested) ? (
          <Pressable hitSlop={hit} style={{ minHeight: 64, borderRadius: 16, paddingHorizontal: 16, justifyContent: "center", backgroundColor: times[bin] === suggested ? colors.olive : "#e7f6ee", borderWidth: 2, borderColor: colors.olive }} onPress={() => setTimes({ ...times, [bin]: suggested })}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: times[bin] === suggested ? "#fff" : colors.ink }}>{clock(suggested, locale)}</Text>
            <Text style={{ marginTop: 4, color: times[bin] === suggested ? "#fff" : colors.olive, fontWeight: "600" }}>{t(locale, "suggestedBadge")}</Text>
          </Pressable>
        ) : null}
        {phase === "time" ? groups.map((group) => (
          <View key={group.key}>
            <Text style={[styles.muted, { marginBottom: 8 }]}>{t(locale, group.key)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {group.items.map((slot) => {
                const on = times[bin] === slot.at;
                return (
                  <Pressable key={slot.at} hitSlop={hit} style={{ width: "31%", minHeight: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.olive : "#fff", borderWidth: 1, borderColor: on ? colors.olive : colors.line }} onPress={() => setTimes({ ...times, [bin]: slot.at })}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: on ? "#fff" : colors.ink }}>{clock(slot.at, locale)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )) : null}
        {phase === "review" ? picked.map((item) => (
          <View key={item} style={styles.card}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{t(locale, `bin_${item}` as MessageKey)}</Text>
            <Text>{kgByBin[item]} kg</Text>
            <Text style={styles.muted}>{times[item] ? formatWhen(times[item], locale) : ""}</Text>
          </View>
        )) : null}
        <View style={[styles.row, { marginTop: 24 }]}>
          {step > 0 ? (
            <Pressable hitSlop={hit} style={[styles.ghost, { minHeight: 48, paddingHorizontal: 16 }]} onPress={() => setStep(step - 1)}>
              <Text>{t(locale, "back")}</Text>
            </Pressable>
          ) : null}
          <Pressable
            hitSlop={hit}
            style={[styles.button, { flex: 1 }]}
            onPress={() => {
              if (phase !== "review") setStep(step + 1);
              else {
                if (picked.some((item) => !kilosOf(kgByBin[item] ?? "") || !times[item])) return;
                void session.api("/bookings", {
                  method: "POST",
                  body: JSON.stringify({ items: picked.map((item) => ({ binType: item, kg: kilosOf(kgByBin[item] ?? ""), scheduledAt: times[item] })) }),
                }).then(() => router.replace("/shop"));
              }
            }}
          >
            <Text style={styles.buttonText}>{phase === "review" ? t(locale, "book") : t(locale, "next")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
