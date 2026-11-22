import { haversineMeters, t } from "@vardia/shared";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Leaflet } from "../src/leaflet";
import { liveHtml } from "../src/map-html";
import type { WebView } from "react-native-webview";
import { explain, useSession } from "../src/session";
import { styles } from "../src/theme";

type Booking = { id: string; status: string; pickup: { lat: number; lng: number; label: string }; rider?: { name: string } };
type Shift = { id: string; title: string; status: string; location: { lat: number; lng: number } | null; muster: { lat: number; lng: number } };

export default function RunScreen() {
  const session = useSession();
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();
  const locale = session.locale;
  const [shift, setShift] = useState<Shift | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const web = useRef<WebView>(null);

  async function load() {
    const body = await session.api<{ shift: Shift; bookings: Booking[] }>(`/shifts/${shiftId}`);
    setShift(body.shift);
    setBookings(body.bookings);
    if (body.shift.location) setHere(body.shift.location);
  }

  useEffect(() => {
    if (!session.token || !shiftId) return;
    load().catch((caught) => setError(caught instanceof Error ? caught.message : "REQUEST_FAILED"));
  }, [session.token, shiftId]);

  useEffect(() => {
    if (shift?.status !== "IN_PROGRESS") return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      sub = await Location.watchPositionAsync({ distanceInterval: 15, timeInterval: 4000 }, (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setHere(point);
        web.current?.injectJavaScript(`window.setVan && window.setVan(${point.lat}, ${point.lng}); true;`);
        void session.api(`/driver/shifts/${shiftId}/location`, {
          method: "POST",
          body: JSON.stringify({ lat: point.lat, lng: point.lng, heading: position.coords.heading, speed: position.coords.speed }),
        });
      });
    })();
    return () => {
      sub?.remove();
    };
  }, [shift?.status, shiftId]);

  const origin = here ?? shift?.location ?? shift?.muster ?? { lat: 37.98, lng: 23.73 };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.title}>{shift?.title ?? t(locale, "navDrive")}</Text>
        <Text style={styles.muted}>{t(locale, "keepOpen")}</Text>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        <View style={{ height: 240, borderRadius: 16, overflow: "hidden" }}>
          <Leaflet ref={web} html={liveHtml(origin.lat, origin.lng)} />
        </View>
        {shift && (shift.status === "OPEN" || shift.status === "LOCKED") ? (
          <Pressable
            style={styles.button}
            onPress={async () => {
              try {
                await session.api(`/driver/shifts/${shiftId}/start`, { method: "POST" });
                await load();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
              }
            }}
          >
            <Text style={styles.buttonText}>{t(locale, "start")}</Text>
          </Pressable>
        ) : null}
        {shift?.status === "IN_PROGRESS" ? (
          <Pressable
            style={styles.button}
            onPress={async () => {
              await session.api(`/driver/shifts/${shiftId}/complete`, { method: "POST" });
              await load();
            }}
          >
            <Text style={styles.buttonText}>{t(locale, "complete")}</Text>
          </Pressable>
        ) : null}
        {bookings.map((booking) => (
          <View key={booking.id} style={styles.card}>
            <Text>
              {booking.rider?.name} · {booking.pickup.label}
              {here ? ` · ${t(locale, "metersAway", { m: Math.round(haversineMeters(here, booking.pickup)) })}` : ""}
            </Text>
            {shift?.status === "IN_PROGRESS" && booking.status === "CONFIRMED" ? (
              <Pressable
                style={styles.ghost}
                onPress={async () => {
                  await session.api(`/driver/shifts/${shiftId}/simulate`, {
                    method: "POST",
                    body: JSON.stringify({ bookingId: booking.id }),
                  });
                  await load();
                }}
              >
                <Text style={{ textAlign: "center" }}>{t(locale, "simulate")}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
