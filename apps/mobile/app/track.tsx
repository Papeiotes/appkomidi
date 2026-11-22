import { t } from "@vardia/shared";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { WebView } from "react-native-webview";
import { io } from "socket.io-client";
import { Leaflet } from "../src/leaflet";
import { liveHtml } from "../src/map-html";
import { LogoutButton } from "../src/logout";
import { useSession } from "../src/session";
import { styles } from "../src/theme";

export default function TrackScreen() {
  const session = useSession();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const locale = session.locale;
  const [arrival, setArrival] = useState(false);
  const [inactive, setInactive] = useState(false);
  const mapHtml = useRef(liveHtml(37.9838, 23.7275)).current;
  const mapRef = useRef<WebView>(null);

  useEffect(() => {
    if (!session.token || !bookingId) return;
    session
      .api<{ booking: { arrivalOpen: boolean }; shift: { id: string; lastLat: number | null; lastLng: number | null } }>(
        `/bookings/${bookingId}/live`,
      )
      .then((body) => {
        setInactive(false);
        setArrival(body.booking.arrivalOpen);
        const move = (lat: number, lng: number) => mapRef.current?.injectJavaScript(`window.setVan && window.setVan(${lat}, ${lng}); true;`);
        if (body.shift.lastLat != null && body.shift.lastLng != null) move(body.shift.lastLat, body.shift.lastLng);
        const socket = io(session.apiUrl, { auth: { token: session.token } });
        socket.emit("shift:join", body.shift.id);
        socket.on("shift:location", (payload: { lat: number; lng: number }) => move(payload.lat, payload.lng));
        socket.on("shift:arrival", () => setArrival(true));
      })
      .catch(() => setInactive(true));
  }, [session.token, bookingId]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: t(locale, "live"), headerRight: () => <LogoutButton /> }} />
      <View style={styles.pad}>
        <Text style={styles.title}>{t(locale, "live")}</Text>
        {inactive ? <Text style={styles.muted}>{t(locale, "liveOnly")}</Text> : null}
        {arrival && !inactive ? <Text style={styles.card}>{t(locale, "arrivedTitle")}. {t(locale, "arrivedBody")}</Text> : null}
        {inactive ? null : (
        <View style={{ height: 360, borderRadius: 16, overflow: "hidden" }}>
          <Leaflet ref={mapRef} html={mapHtml} />
        </View>
        )}
      </View>
    </SafeAreaView>
  );
}
