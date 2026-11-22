import { HORIZON_DAYS, athensDateKey, athensDatePlus, athensParts, formatWhen, t, type Locale, type MessageKey } from "@vardia/shared";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogoutButton } from "../src/logout";
import { useSession } from "../src/session";
import { colors, styles } from "../src/theme";

const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;
const brackets = ["KG_0_10", "KG_10_20", "KG_20_50", "KG_50_PLUS"] as const;
type Slot = { at: string; bookable: boolean };
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
  const [bracketsByBin, setBracketsByBin] = useState<Record<string, string>>({});
  const [day, setDay] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const days = Array.from({ length: HORIZON_DAYS }, (_, index) => athensDatePlus(index));
  const total = 2 + picked.length * 2 + 1;
  const afterDay = step - 2;
  const binPair = Math.floor(afterDay / 2);
  const phase = step === 0 ? "bin" : step === 1 ? "day" : binPair >= picked.length ? "review" : afterDay % 2 === 0 ? "kg" : "time";
  const bin = picked[binPair] ?? "";

  useEffect(() => {
    if (phase !== "time" || !bin || !day || !bracketsByBin[bin]) return;
    session.api<{ slots: Slot[]; suggested: string | null }>(`/slots?binType=${bin}&bracket=${bracketsByBin[bin]}`).then((body) => {
      setSlots(body.slots.filter((slot) => athensDateKey(new Date(slot.at)) === day));
      setSuggested(body.suggested && athensDateKey(new Date(body.suggested)) === day ? body.suggested : null);
    });
  }, [phase, bin, day, bracketsByBin]);

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
        {phase === "day" ? days.map((item) => (
          <Pressable key={item} hitSlop={hit} style={[styles.card, { minHeight: 52, justifyContent: "center" }, day === item && { borderColor: colors.olive, backgroundColor: "#e7f6ee" }]} onPress={() => setDay(item)}>
            <Text style={{ fontSize: 18 }}>{item}</Text>
          </Pressable>
        )) : null}
        {phase === "kg" ? brackets.map((item) => (
          <Pressable key={item} hitSlop={hit} style={[styles.card, { minHeight: 56, justifyContent: "center" }, bracketsByBin[bin] === item && { borderColor: colors.olive, backgroundColor: "#e7f6ee" }]} onPress={() => setBracketsByBin((current) => ({ ...current, [bin]: item }))}>
            <Text style={{ fontSize: 18 }}>{t(locale, `bracket_${item}` as MessageKey)}</Text>
          </Pressable>
        )) : null}
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
            <Text>{t(locale, `bracket_${bracketsByBin[item]}` as MessageKey)}</Text>
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
                void session.api("/bookings", {
                  method: "POST",
                  body: JSON.stringify({ items: picked.map((item) => ({ binType: item, bracket: bracketsByBin[item], scheduledAt: times[item] })) }),
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
