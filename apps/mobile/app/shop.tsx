import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogoutButton } from "../src/logout";
import { useSession } from "../src/session";
import { colors, styles } from "../src/theme";

type Booking = { id: string; binType: string; kg: number; status: string; scheduledAt: string; arrivalOpen: boolean; shift: { id: string; status: string } };

export default function ShopScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [pending, setPending] = useState(false);
  const [rows, setRows] = useState<Booking[]>([]);

  useEffect(() => {
    if (!session.token) return;
    session.api<{ business: { status: string } }>("/business").then(async (body) => {
      setPending(body.business.status !== "APPROVED");
      if (body.business.status === "APPROVED") {
        const list = await session.api<{ bookings: Booking[] }>("/bookings/mine");
        setRows(list.bookings.filter((row) => row.status === "CONFIRMED"));
      }
    });
  }, [session.token]);

  const live = rows.find((row) => row.shift.status === "IN_PROGRESS" || row.arrivalOpen);

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
        <Text style={[styles.muted, { marginTop: 28 }]}>{t(locale, "upcoming")}</Text>
        {rows.length === 0 ? <Text style={{ marginTop: 8 }}>{t(locale, "emptyNext")}</Text> : null}
        {rows.map((row) => (
          <View key={row.id} style={[styles.card, { marginTop: 10 }]}>
            <Text style={{ fontSize: 18 }}>{t(locale, `bin_${row.binType}` as MessageKey)}</Text>
            <Text style={styles.muted}>{formatWhen(row.scheduledAt, locale)} · {row.kg} kg</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
