import { formatWhen, t } from "@vardia/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../src/session";
import { styles } from "../src/theme";

type Shift = { id: string; title: string; businessName: string; departsAt: string; status: string; remainingSeats: number; capacity: number };

export default function DriverScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    if (!session.token) return;
    session.api<{ shifts: Shift[] }>("/driver/shifts").then((body) => setShifts(body.shifts));
  }, [session.token]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.row}>
          <Text style={styles.title}>{t(locale, "navDrive")}</Text>
          <Pressable onPress={() => session.logout().then(() => router.replace("/"))}>
            <Text>{t(locale, "logout")}</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>{t(locale, "keepOpen")}</Text>
        {shifts.length === 0 ? <Text style={styles.muted}>{t(locale, "emptyShifts")}</Text> : null}
        {shifts.map((shift) => (
          <Pressable key={shift.id} style={styles.card} onPress={() => router.push({ pathname: "/run", params: { shiftId: shift.id } })}>
            <Text style={{ fontWeight: "600" }}>{shift.businessName}</Text>
            <Text>{shift.title}</Text>
            <Text style={styles.muted}>
              {formatWhen(shift.departsAt, locale)} · {shift.status} · {t(locale, "seatsLeftCount", { n: shift.remainingSeats })}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
