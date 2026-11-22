import { athensDateKey, formatWhen, t, type MessageKey } from "@vardia/shared";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogoutButton } from "../src/logout";
import { useSession } from "../src/session";
import { colors, styles } from "../src/theme";

type Booking = { id: string; binType: string; kg: number; status: string; cancelReason: string | null; scheduledAt: string; arrivalOpen: boolean; shift: { id: string; status: string } };

export default function ShopScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [rows, setRows] = useState<Booking[]>([]);

  useEffect(() => {
    if (!session.token) return;
    session.api<{ business: { status: string } }>("/business").then(async (body) => {
      setPending(body.business.status !== "APPROVED");
      if (body.business.status === "APPROVED") {
        const list = await session.api<{ bookings: Booking[] }>("/bookings/mine");
        setRows(list.bookings);
      }
    });
  }, [session.token]);

  const today = athensDateKey(new Date());
  const upcoming = rows.filter((row) => row.status === "CONFIRMED");
  const history = rows.filter((row) => row.status !== "CONFIRMED");
  const shown = tab === "history" ? history : upcoming;
  const live = upcoming.find((row) => athensDateKey(new Date(row.scheduledAt)) === today && (row.shift.status === "IN_PROGRESS" || row.shift.status === "PAUSED"));

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: t(locale, "brand"), headerRight: () => <LogoutButton /> }} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 }]}>
        <View style={styles.row}>
          <Text style={[styles.title, { color: colors.olive }]}>{t(locale, "brand")}</Text>
          <Pressable onPress={() => session.setLocale(locale === "el" ? "en" : "el")}><Text>{locale === "el" ? "EN" : "ΕΛ"}</Text></Pressable>
        </View>
        {pending ? <Text style={styles.muted}>{t(locale, "pendingBody")}</Text> : (
          <Pressable style={[styles.button, { paddingVertical: 20, marginTop: 12 }]} onPress={() => router.push("/book")}>
            <Text style={[styles.buttonText, { fontSize: 18 }]}>{t(locale, "bookCta")}</Text>
          </Pressable>
        )}
        {live ? (
          <Pressable style={[styles.card, { marginTop: 16, borderColor: colors.olive }]} onPress={() => router.push({ pathname: "/track", params: { bookingId: live.id } })}>
            <Text style={{ color: colors.olive }}>{t(locale, "onTheWay")}</Text>
            <Text style={{ fontSize: 20, fontWeight: "700" }}>{live.arrivalOpen ? t(locale, "arrivedTitle") : t(locale, "eta")}</Text>
          </Pressable>
        ) : null}
        <View style={[styles.row, { marginTop: 28 }]}>
          {(["upcoming", "history"] as const).map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={{ flex: 1, minHeight: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: tab === item ? colors.olive : "#fff", borderWidth: 1, borderColor: tab === item ? colors.olive : colors.line }}>
              <Text style={{ color: tab === item ? "#fff" : colors.ink, fontWeight: "600" }}>{t(locale, item)}</Text>
            </Pressable>
          ))}
        </View>
        {shown.length === 0 ? <Text style={{ marginTop: 8 }}>{t(locale, "emptyNext")}</Text> : null}
        {shown.map((row) => (
          <View key={row.id} style={[styles.card, { marginTop: 10 }]}>
            <Text style={{ fontSize: 18 }}>{t(locale, `bin_${row.binType}` as MessageKey)}</Text>
            <Text style={styles.muted}>{formatWhen(row.scheduledAt, locale)} · {row.kg} kg</Text>
            {tab === "history" ? <Text>{row.cancelReason === "expired" ? t(locale, "expired") : t(locale, `status_${row.status}` as MessageKey)}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
