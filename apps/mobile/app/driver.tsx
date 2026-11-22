import { formatWhen, t } from "@vardia/shared";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Leaflet } from "../src/leaflet";
import { liveHtml } from "../src/map-html";
import { explain, useSession } from "../src/session";
import { styles } from "../src/theme";

type Stop = { id: string; status: string; business: string; label: string; kg: number; scheduledAt: string; lat: number; lng: number };
type Payload = {
  shift: { id: string; status: string; binType: string; startsAt: string; lastLat: number | null; lastLng: number | null } | null;
  stops: Stop[];
  nextStopId: string | null;
};

export default function DriverScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setData(await session.api<Payload>("/driver/shift"));
  }

  useEffect(() => {
    if (!session.token) return;
    load().catch((caught) => setError(caught instanceof Error ? caught.message : "REQUEST_FAILED"));
    const timer = setInterval(() => void load().catch(() => undefined), 6000);
    return () => clearInterval(timer);
  }, [session.token]);

  useEffect(() => {
    if (data?.shift?.status !== "IN_PROGRESS" && data?.shift?.status !== "PAUSED") return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      sub = await Location.watchPositionAsync({ distanceInterval: 20, timeInterval: 5000 }, (position) => {
        void session.api(`/driver/shifts/${data.shift!.id}/location`, {
          method: "POST",
          body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude }),
        });
      });
    })();
    return () => sub?.remove();
  }, [data?.shift?.id, data?.shift?.status]);

  const shift = data?.shift;
  const next = data?.stops.find((stop) => stop.id === data.nextStopId);
  const origin = next ?? { lat: shift?.lastLat ?? 37.98, lng: shift?.lastLng ?? 23.73 };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.row}>
          <Text style={styles.title}>{t(locale, "navDrive")}</Text>
          <Pressable onPress={() => session.logout().then(() => router.replace("/"))}>
            <Text>{t(locale, "logout")}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        {!shift ? <Text style={styles.muted}>{t(locale, "noShift")}</Text> : null}
        {shift?.status === "SCHEDULED" ? (
          <Pressable
            style={[styles.button, { paddingVertical: 22 }]}
            onPress={async () => {
              const position = await Location.getCurrentPositionAsync({}).catch(() => null);
              const lat = position?.coords.latitude ?? 37.98;
              const lng = position?.coords.longitude ?? 23.73;
              await session.api(`/driver/shifts/${shift.id}/start`, { method: "POST", body: JSON.stringify({ lat, lng }) });
              await load();
            }}
          >
            <Text style={[styles.buttonText, { fontSize: 22 }]}>{t(locale, "startShift")}</Text>
          </Pressable>
        ) : null}
        {next ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{t(locale, "nextStop")}</Text>
            <Text style={{ fontSize: 20, fontWeight: "700" }}>{next.business}</Text>
            <Text>{next.label} · {next.kg} kg · {formatWhen(next.scheduledAt, locale)}</Text>
          </View>
        ) : null}
        <View style={{ height: 240, borderRadius: 16, overflow: "hidden" }}>
          <Leaflet html={liveHtml(origin.lat, origin.lng)} />
        </View>
        {shift?.status === "IN_PROGRESS" ? (
          <Pressable style={styles.button} onPress={async () => { await session.api(`/driver/shifts/${shift.id}/complete`, { method: "POST" }); await load(); }}>
            <Text style={styles.buttonText}>{t(locale, "completeStop")}</Text>
          </Pressable>
        ) : null}
        <View style={styles.row}>
          {shift?.status === "IN_PROGRESS" ? (
            <Pressable style={styles.ghost} onPress={async () => { await session.api(`/driver/shifts/${shift.id}/pause`, { method: "POST" }); await load(); }}>
              <Text>{t(locale, "pause")}</Text>
            </Pressable>
          ) : null}
          {shift?.status === "PAUSED" ? (
            <Pressable style={styles.ghost} onPress={async () => { await session.api(`/driver/shifts/${shift.id}/resume`, { method: "POST" }); await load(); }}>
              <Text>{t(locale, "resume")}</Text>
            </Pressable>
          ) : null}
          {shift && shift.status !== "SCHEDULED" ? (
            <Pressable style={styles.ghost} onPress={async () => { await session.api(`/driver/shifts/${shift.id}/end`, { method: "POST" }); await load(); }}>
              <Text>{t(locale, "endShift")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
