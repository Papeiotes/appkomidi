import { formatWhen, t, type MessageKey } from "@vardia/shared";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Leaflet } from "../src/leaflet";
import { liveHtml } from "../src/map-html";
import { explain, useSession } from "../src/session";
import { colors } from "../src/theme";

type Stop = { id: string; business: string; phone: string; label: string; kg: number; bracket: string; binType: string; scheduledAt: string; lat: number; lng: number };
type Payload = { shift: { id: string; status: string; lastLat: number | null; lastLng: number | null } | null; stops: Stop[]; nextStopId: string | null };

export default function DriverScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [data, setData] = useState<Payload | null>(null);
  const [menu, setMenu] = useState(false);
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
    void Location.requestForegroundPermissionsAsync().then(async (permission) => {
      if (!permission.granted || !data.shift) return;
      sub = await Location.watchPositionAsync({ distanceInterval: 20, timeInterval: 5000 }, (position) => {
        void session.api(`/driver/shifts/${data.shift!.id}/location`, {
          method: "POST",
          body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude }),
        });
      });
    });
    return () => sub?.remove();
  }, [data?.shift?.id, data?.shift?.status]);

  const shift = data?.shift;
  const next = data?.stops.find((stop) => stop.id === data?.nextStopId);
  const center = next ?? { lat: 37.9838, lng: 23.7275 };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Leaflet html={liveHtml(center.lat, center.lng)} />
      <Pressable style={{ position: "absolute", top: 48, right: 16, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }} onPress={() => setMenu((open) => !open)}>
        <Text>{t(locale, "menu")}</Text>
      </Pressable>
      {menu && shift ? (
        <View style={{ position: "absolute", top: 92, right: 16, backgroundColor: "#fff", borderRadius: 16, padding: 12, gap: 10 }}>
          {shift.status === "IN_PROGRESS" ? <Pressable onPress={() => void session.api(`/driver/shifts/${shift.id}/pause`, { method: "POST" }).then(load)}><Text>{t(locale, "pause")}</Text></Pressable> : null}
          {shift.status === "PAUSED" ? <Pressable onPress={() => void session.api(`/driver/shifts/${shift.id}/resume`, { method: "POST" }).then(load)}><Text>{t(locale, "resume")}</Text></Pressable> : null}
          <Pressable onPress={() => void session.api(`/driver/shifts/${shift.id}/end`, { method: "POST" }).then(load)}><Text>{t(locale, "endShift")}</Text></Pressable>
          <Pressable onPress={() => session.logout().then(() => router.replace("/"))}><Text>{t(locale, "logout")}</Text></Pressable>
        </View>
      ) : null}
      {error ? <Text style={{ position: "absolute", top: 48, left: 16 }}>{explain(locale, error)}</Text> : null}
      {shift?.status === "SCHEDULED" ? (
        <Pressable
          style={{ position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: colors.olive, borderRadius: 999, paddingVertical: 22, alignItems: "center" }}
          onPress={async () => {
            const position = await Location.getCurrentPositionAsync({}).catch(() => null);
            await session.api(`/driver/shifts/${shift.id}/start`, { method: "POST", body: JSON.stringify({ lat: position?.coords.latitude ?? 37.9838, lng: position?.coords.longitude ?? 23.7275 }) });
            await load();
          }}
        >
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>{t(locale, "startShift")}</Text>
        </Pressable>
      ) : null}
      {next && shift?.status !== "SCHEDULED" ? (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 16, backgroundColor: "#fff", borderRadius: 24, padding: 18 }}>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{next.business}</Text>
          <Text style={{ marginTop: 4, color: "#5c6b62" }}>{next.label}</Text>
          <Text style={{ marginTop: 8 }}>{t(locale, `bin_${next.binType}` as MessageKey)} · {t(locale, `bracket_${next.bracket}` as MessageKey)}</Text>
          <Text>{t(locale, "windowLabel")}: {formatWhen(next.scheduledAt, locale)}</Text>
          <Text>{next.phone}</Text>
          {shift?.status === "IN_PROGRESS" ? (
            <Pressable style={{ marginTop: 14, backgroundColor: colors.olive, borderRadius: 16, paddingVertical: 16, alignItems: "center" }} onPress={() => void session.api(`/driver/shifts/${shift.id}/complete`, { method: "POST" }).then(load)}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{t(locale, "completeStop")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
