import { t } from "@vardia/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { WebView } from "react-native-webview";
import { io } from "socket.io-client";
import { Leaflet } from "../src/leaflet";
import { liveHtml } from "../src/map-html";
import { useSession } from "../src/session";
import { styles } from "../src/theme";

export default function TrackScreen() {
  const session = useSession();
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();
  const locale = session.locale;
  const [title, setTitle] = useState("");
  const [arrived, setArrived] = useState(false);
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState({ lat: 37.98, lng: 23.73 });
  const web = useRef<WebView>(null);

  useEffect(() => {
    if (!session.token || !shiftId) return;
    session.api<{ shift: { title: string; status: string; location: { lat: number; lng: number } | null; muster: { lat: number; lng: number } }; arrived: boolean }>(`/shifts/${shiftId}`).then((body) => {
      setTitle(body.shift.title);
      setStatus(body.shift.status);
      setArrived(body.arrived);
      setOrigin(body.shift.location ?? body.shift.muster);
    });
    const socket = io(session.apiUrl, { auth: { token: session.token } });
    socket.emit("shift:join", shiftId);
    socket.on("shift:location", (payload: { lat: number; lng: number }) => {
      web.current?.injectJavaScript(`window.setVan && window.setVan(${payload.lat}, ${payload.lng}); true;`);
    });
    socket.on("shift:arrival", () => setArrived(true));
    socket.on("shift:status", (payload: { status: string }) => setStatus(payload.status));
    return () => {
      socket.disconnect();
    };
  }, [session.token, session.apiUrl, shiftId]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pad}>
        <Text style={styles.title}>{title || t(locale, "track")}</Text>
        <Text style={styles.muted}>{status === "IN_PROGRESS" ? t(locale, "vanHere") : t(locale, "waitingForDriver")}</Text>
        {arrived ? <Text style={[styles.card, { backgroundColor: "#e39b2b" }]}>{t(locale, "arrived")}</Text> : null}
        <View style={{ height: 360, borderRadius: 16, overflow: "hidden" }}>
          <Leaflet ref={web} html={liveHtml(origin.lat, origin.lng)} />
        </View>
      </View>
    </SafeAreaView>
  );
}
