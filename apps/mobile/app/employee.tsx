import { formatWhen, t } from "@vardia/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { explain, useSession } from "../src/session";
import { styles } from "../src/theme";

type Shift = {
  id: string;
  title: string;
  departsAt: string;
  remainingSeats: number;
  bookable: boolean;
  myBooking: { id: string } | null;
  status: string;
};

export default function EmployeeScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const body = await session.api<{ shifts: Shift[] }>("/shifts/available");
    setShifts(body.shifts);
  }

  useEffect(() => {
    if (!session.token) return;
    load().catch((caught) => setError(caught instanceof Error ? caught.message : "REQUEST_FAILED"));
  }, [session.token]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.row}>
          <Text style={styles.title}>{t(locale, "navBook")}</Text>
          <Pressable onPress={() => session.logout().then(() => router.replace("/"))}>
            <Text>{t(locale, "logout")}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        {shifts.length === 0 ? <Text style={styles.muted}>{t(locale, "emptyShifts")}</Text> : null}
        {shifts.map((shift) => (
          <View key={shift.id} style={styles.card}>
            <Text style={{ fontWeight: "600", color: "#1c2416" }}>{shift.title}</Text>
            <Text style={styles.muted}>
              {formatWhen(shift.departsAt, locale)} · {t(locale, "seatsLeftCount", { n: shift.remainingSeats })}
            </Text>
            {shift.myBooking ? (
              <Pressable style={styles.button} onPress={() => router.push({ pathname: "/track", params: { shiftId: shift.id } })}>
                <Text style={styles.buttonText}>{t(locale, "track")}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.button, !shift.bookable && { opacity: 0.45 }]}
                disabled={!shift.bookable}
                onPress={async () => {
                  setError(null);
                  try {
                    await session.api("/bookings", { method: "POST", body: JSON.stringify({ shiftId: shift.id, seats: 1 }) });
                    await load();
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
                  }
                }}
              >
                <Text style={styles.buttonText}>{shift.bookable ? t(locale, "book") : t(locale, "full")}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
