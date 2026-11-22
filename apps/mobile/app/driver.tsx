import { formatWhen, t, type MessageKey } from "@vardia/shared";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { WebView } from "react-native-webview";
import { Leaflet } from "../src/leaflet";
import { liveHtml } from "../src/map-html";
import { explain, useSession } from "../src/session";
import { colors } from "../src/theme";

type Stop = { id: string; business: string; phone: string; label: string; kg: number; bracket: string; binType: string; scheduledAt: string; lat: number; lng: number };
type Payload = { shift: { id: string; status: string; lastLat: number | null; lastLng: number | null } | null; stops: Stop[]; nextStopId: string | null; eta?: string | null; route?: { coordinates: [number, number][] } | null };

export default function DriverScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [data, setData] = useState<Payload | null>(null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapHtml = useRef(liveHtml(37.9838, 23.7275)).current;
  const mapRef = useRef<WebView>(null);

  function moveVan(lat: number, lng: number) {
    mapRef.current?.injectJavaScript(`window.setVan && window.setVan(${lat}, ${lng}); true;`);
  }

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
      sub = await Location.watchPositionAsync({ distanceInterval: 8, timeInterval: 2000 }, (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        moveVan(lat, lng);
        void session.api(`/driver/shifts/${data.shift!.id}/location`, {
          method: "POST",
          body: JSON.stringify({ lat, lng }),
        });
      });
    });
    return () => sub?.remove();
  }, [data?.shift?.id, data?.shift?.status]);

  const shift = data?.shift;
  const next = data?.stops.find((stop) => stop.id === data?.nextStopId);
  const done = (data?.stops ?? []).filter((stop) => stop.status === "COMPLETED");

  useEffect(() => {
    if (shift?.lastLat == null || shift.lastLng == null) return;
    moveVan(shift.lastLat, shift.lastLng);
  }, [shift?.lastLat, shift?.lastLng]);

  useEffect(() => {
    const confirmed = (data?.stops ?? []).filter((stop) => stop.status === "CONFIRMED");
    const pins = confirmed.map((stop) => ({ id: stop.id, lat: stop.lat, lng: stop.lng, active: stop.id === data?.nextStopId }));
    const line = (data?.route?.coordinates ?? []).map(([lng, lat]) => [lat, lng]);
    mapRef.current?.injectJavaScript(`window.setStops && window.setStops(${JSON.stringify(pins)}); window.setLine && window.setLine(${JSON.stringify(line)}); true;`);
  }, [data?.stops, data?.nextStopId, data?.route]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Leaflet ref={mapRef} html={mapHtml} />
      <Pressable hitSlop={12} style={{ position: "absolute", top: 48, right: 16, zIndex: 20, elevation: 20, minHeight: 44, justifyContent: "center", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 16 }} onPress={() => setMenu((open) => !open)}>
        <Text>{t(locale, "menu")}</Text>
      </Pressable>
      {menu && shift ? (
        <View style={{ position: "absolute", top: 92, right: 16, backgroundColor: "#fff", borderRadius: 16, padding: 12, gap: 10 }}>
          {shift.status === "IN_PROGRESS" ? <Pressable hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }} onPress={() => void session.api(`/driver/shifts/${shift.id}/pause`, { method: "POST" }).then(load)}><Text>{t(locale, "pause")}</Text></Pressable> : null}
          {shift.status === "PAUSED" ? <Pressable hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }} onPress={() => void session.api(`/driver/shifts/${shift.id}/resume`, { method: "POST" }).then(load)}><Text>{t(locale, "resume")}</Text></Pressable> : null}
          <Pressable hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }} onPress={() => void session.api(`/driver/shifts/${shift.id}/end`, { method: "POST" }).then(load)}><Text>{t(locale, "endShift")}</Text></Pressable>
          <Pressable hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }} onPress={() => session.logout().then(() => router.replace("/"))}><Text>{t(locale, "logout")}</Text></Pressable>
        </View>
      ) : null}
      {error ? <Text style={{ position: "absolute", top: 48, left: 16 }}>{explain(locale, error)}</Text> : null}
      {shift?.status === "SCHEDULED" ? (
        <Pressable
          hitSlop={12}
          style={{ position: "absolute", bottom: 24, left: 16, right: 16, zIndex: 20, elevation: 20, minHeight: 64, backgroundColor: colors.olive, borderRadius: 999, alignItems: "center", justifyContent: "center" }}
          onPress={async () => {
            const position = await Promise.race([
              Location.getCurrentPositionAsync({}).catch(() => null),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
            ]);
            await session.api(`/driver/shifts/${shift.id}/start`, { method: "POST", body: JSON.stringify({ lat: position?.coords.latitude ?? 37.971, lng: position?.coords.longitude ?? 23.728 }) });
            await load();
          }}
        >
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>{t(locale, "startShift")}</Text>
        </Pressable>
      ) : null}
      {next && shift?.status !== "SCHEDULED" ? (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 16, zIndex: 20, elevation: 20, backgroundColor: "#fff", borderRadius: 24, padding: 18 }}>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{next.business}</Text>
          <Text style={{ marginTop: 4, color: "#5c6b62" }}>{next.label}</Text>
          <Text style={{ marginTop: 8 }}>{t(locale, `bin_${next.binType}` as MessageKey)} · {t(locale, `bracket_${next.bracket}` as MessageKey)}</Text>
          <Text>{t(locale, "windowLabel")}: {formatWhen(next.scheduledAt, locale)} {t(locale, "windowFlex")}</Text>
          <Text>{t(locale, "eta")}: {data?.eta ? formatWhen(data.eta, locale) : "—"}</Text>
          <Text>{next.phone}</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Pressable hitSlop={8} style={{ flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.olive, borderRadius: 16, alignItems: "center", justifyContent: "center" }} onPress={() => void session.api(`/driver/shifts/${shift.id}/${shift.status === "PAUSED" ? "resume" : "pause"}`, { method: "POST" }).then(load)}>
              <Text style={{ color: colors.olive, fontWeight: "700" }}>{shift.status === "PAUSED" ? t(locale, "resume") : t(locale, "pause")}</Text>
            </Pressable>
            <Pressable hitSlop={8} disabled={shift.status !== "IN_PROGRESS"} style={{ flex: 1, minHeight: 52, backgroundColor: colors.olive, borderRadius: 16, alignItems: "center", justifyContent: "center", opacity: shift.status === "IN_PROGRESS" ? 1 : 0.4 }} onPress={() => void session.api(`/driver/shifts/${shift.id}/complete`, { method: "POST" }).then(load)}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{t(locale, "completeStop")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {shift?.status === "ENDED" ? (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 16, zIndex: 20, elevation: 20, backgroundColor: "#fff", borderRadius: 24, padding: 18 }}>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{t(locale, "shiftDone")}</Text>
          {done.map((stop) => <Text key={stop.id} style={{ marginTop: 6 }}>{stop.business}</Text>)}
        </View>
      ) : null}
    </View>
  );
}
