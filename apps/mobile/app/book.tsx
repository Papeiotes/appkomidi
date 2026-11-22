import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../src/session";
import { colors, styles } from "../src/theme";

const bins = ["GREEN", "BLUE", "YELLOW", "BROWN"] as const;
const brackets = ["KG_0_10", "KG_10_20", "KG_20_50", "KG_50_PLUS"] as const;
type Slot = { at: string; bookable: boolean };

export default function BookScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [bracket, setBracket] = useState("KG_0_10");
  const [day, setDay] = useState("");
  const [times, setTimes] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().slice(0, 10);
  });
  const timeIndex = step - 3;
  const phase = step === 0 ? "bin" : step === 1 ? "kg" : step === 2 ? "day" : step < 3 + picked.length ? "time" : "review";
  useEffect(() => {
    const bin = picked[timeIndex];
    if (phase !== "time" || !bin) return;
    session.api<{ slots: Slot[]; suggested: string | null }>(`/slots?binType=${bin}&bracket=${bracket}`).then((body) => {
      setSlots(body.slots.filter((slot) => slot.at.slice(0, 10) === day));
      setSuggested(body.suggested);
    });
  }, [phase, timeIndex, day, bracket]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={{ height: 6, backgroundColor: "#f4f7f5", borderRadius: 99 }}>
          <View style={{ height: 6, width: `${((step + 1) / (4 + picked.length)) * 100}%`, backgroundColor: colors.olive, borderRadius: 99 }} />
        </View>
        <Text style={[styles.title, { marginTop: 16 }]}>
          {phase === "bin" ? t(locale, "pickBin") : phase === "kg" ? t(locale, "statsKg") : phase === "day" ? t(locale, "pickDay") : phase === "time" ? t(locale, "pickTime") : t(locale, "review")}
        </Text>
        {phase === "bin" ? bins.map((item) => (
          <Pressable key={item} style={[styles.card, picked.includes(item) && { borderColor: colors.olive }]} onPress={() => setPicked((current) => current.includes(item) ? current.filter((id) => id !== item) : [...current, item])}>
            <Text style={{ fontSize: 18 }}>{t(locale, `bin_${item}` as MessageKey)}</Text>
          </Pressable>
        )) : null}
        {phase === "kg" ? brackets.map((item) => (
          <Pressable key={item} style={[styles.card, bracket === item && { borderColor: colors.olive }]} onPress={() => setBracket(item)}>
            <Text style={{ fontSize: 18 }}>{t(locale, `bracket_${item}` as MessageKey)}</Text>
          </Pressable>
        )) : null}
        {phase === "day" ? days.map((item) => (
          <Pressable key={item} style={[styles.card, day === item && { borderColor: colors.olive }]} onPress={() => setDay(item)}><Text>{item}</Text></Pressable>
        )) : null}
        {phase === "time" ? slots.map((slot) => (
          <Pressable key={slot.at} disabled={!slot.bookable} style={[styles.card, times[picked[timeIndex]] === slot.at && { borderColor: colors.olive }, slot.at === suggested && { backgroundColor: "#e7f6ee" }, !slot.bookable && { opacity: 0.4 }]} onPress={() => setTimes({ ...times, [picked[timeIndex]]: slot.at })}>
            <Text>{formatWhen(slot.at, locale)}{slot.at === suggested ? ` · ${t(locale, "suggested")}` : ""}{slot.bookable ? "" : ` · ${t(locale, "unavailable")}`}</Text>
          </Pressable>
        )) : null}
        {phase === "review" ? picked.map((bin) => <Text key={bin} style={{ fontSize: 18, marginTop: 8 }}>{t(locale, `bin_${bin}` as MessageKey)}</Text>) : null}
        <View style={[styles.row, { marginTop: 24 }]}>
          {step > 0 ? <Pressable style={styles.ghost} onPress={() => setStep(step - 1)}><Text>{t(locale, "back")}</Text></Pressable> : null}
          <Pressable style={[styles.button, { flex: 1 }]} onPress={() => {
            if (phase !== "review") setStep(step + 1);
            else void session.api("/bookings", { method: "POST", body: JSON.stringify({ items: picked.map((bin) => ({ binType: bin, bracket, scheduledAt: times[bin] })) }) }).then(() => router.replace("/shop"));
          }}>
            <Text style={styles.buttonText}>{phase === "review" ? t(locale, "book") : t(locale, "next")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
