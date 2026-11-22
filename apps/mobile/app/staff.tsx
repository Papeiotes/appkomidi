import { t } from "@vardia/shared";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogoutButton } from "../src/logout";
import { useSession } from "../src/session";
import { colors, styles } from "../src/theme";

type Biz = { id: string; name: string; afm: string; addressLabel: string; lat: number; lng: number };

export default function StaffScreen() {
  const session = useSession();
  const locale = session.locale;
  const [rows, setRows] = useState<Biz[]>([]);

  async function load() {
    const body = await session.api<{ businesses: Biz[] }>("/admin/businesses?status=PENDING");
    setRows(body.businesses);
  }
  useEffect(() => {
    if (session.token) void load().catch(() => undefined);
  }, [session.token]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: t(locale, "navApprovals"), headerRight: () => <LogoutButton /> }} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 40 }]}>
        <Text style={styles.title}>{t(locale, "navApprovals")}</Text>
        {rows.length === 0 ? <Text style={styles.muted}>{t(locale, "empty")}</Text> : null}
        {rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{row.name}</Text>
            <Text style={styles.muted}>{row.afm}</Text>
            <Text>{row.addressLabel}</Text>
            <View style={styles.row}>
              <Pressable style={[styles.button, { flex: 1 }]} onPress={() => void session.api(`/admin/businesses/${row.id}/approve`, { method: "POST", body: JSON.stringify({ lat: row.lat, lng: row.lng }) }).then(load)}>
                <Text style={styles.buttonText}>{t(locale, "approve")}</Text>
              </Pressable>
              <Pressable style={[styles.ghost, { flex: 1, minHeight: 48, justifyContent: "center" }]} onPress={() => void session.api(`/admin/businesses/${row.id}/reject`, { method: "POST", body: JSON.stringify({}) }).then(load)}>
                <Text style={{ color: colors.danger, fontWeight: "600" }}>{t(locale, "reject")}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
