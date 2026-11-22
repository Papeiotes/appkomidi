import { formatWhen, t, type MessageKey } from "@vardia/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { explain, useSession } from "../src/session";
import { styles } from "../src/theme";

type Slot = { at: string; remainingKg: number; bookable: boolean };
type Booking = { id: string; binType: string; kg: number; status: string; scheduledAt: string; arrivalOpen: boolean; shift: { id: string } };

export default function ShopScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [bin, setBin] = useState("GREEN");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [when, setWhen] = useState<string | null>(null);
  const [mine, setMine] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const profile = await session.api<{ business: { status: string } }>("/business");
    setPending(profile.business.status !== "APPROVED");
    if (profile.business.status !== "APPROVED") return;
    const body = await session.api<{ slots: Slot[]; suggested: string | null }>(`/slots?binType=${bin}`);
    setSlots(body.slots);
    setSuggested(body.suggested);
    const list = await session.api<{ bookings: Booking[] }>("/bookings/mine");
    setMine(list.bookings);
  }

  useEffect(() => {
    if (!session.token) return;
    load().catch((caught) => setError(caught instanceof Error ? caught.message : "REQUEST_FAILED"));
  }, [session.token, bin]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.row}>
          <Text style={styles.title}>{t(locale, "brand")}</Text>
          <Pressable onPress={() => session.logout().then(() => router.replace("/"))}>
            <Text>{t(locale, "logout")}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        {pending ? <Text style={styles.muted}>{t(locale, "pendingBody")}</Text> : null}
        {!pending ? (
          <>
            <View style={styles.row}>
              {["GREEN", "BLUE", "YELLOW", "BROWN"].map((item) => (
                <Pressable key={item} onPress={() => setBin(item)}>
                  <Text style={{ fontWeight: bin === item ? "700" : "400" }}>{t(locale, `bin_${item}` as MessageKey).split("·")[0]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.muted}>{t(locale, "disclaimer")}</Text>
            {suggested ? <Text>{t(locale, "suggested")}: {formatWhen(suggested, locale)}</Text> : null}
            {slots.slice(0, 12).map((slot) => (
              <Pressable key={slot.at} style={styles.card} onPress={() => slot.bookable && setWhen(slot.at)}>
                <Text style={{ color: slot.bookable ? "#142018" : "#9aa69e" }}>
                  {formatWhen(slot.at, locale)} · {slot.remainingKg} kg {when === slot.at ? "•" : ""}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.button}
              onPress={async () => {
                if (!when) return;
                setError(null);
                try {
                  await session.api("/bookings", {
                    method: "POST",
                    body: JSON.stringify({ items: [{ binType: bin, bracket: "KG_0_10", scheduledAt: when }] }),
                  });
                  await load();
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
                }
              }}
            >
              <Text style={styles.buttonText}>{t(locale, "book")}</Text>
            </Pressable>
            {mine.map((booking) => (
              <View key={booking.id} style={styles.card}>
                <Text>
                  {booking.binType} · {booking.kg} kg · {formatWhen(booking.scheduledAt, locale)}
                </Text>
                {booking.arrivalOpen ? <Text>{t(locale, "arrivedTitle")}</Text> : null}
                {booking.status === "CONFIRMED" ? (
                  <Pressable onPress={() => router.push({ pathname: "/track", params: { shiftId: booking.shift.id, bookingId: booking.id } })}>
                    <Text>{t(locale, "live")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
