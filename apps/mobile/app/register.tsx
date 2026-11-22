import { t } from "@vardia/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Leaflet } from "../src/leaflet";
import { pickerHtml } from "../src/map-html";
import { explain, useSession, type User } from "../src/session";
import { styles } from "../src/theme";

const roles = ["BUSINESS_OWNER", "DRIVER", "EMPLOYEE"] as const;

export default function RegisterScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [role, setRole] = useState<(typeof roles)[number]>("EMPLOYEE");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("Αθήνα");
  const [lat, setLat] = useState(37.9838);
  const [lng, setLng] = useState(23.7275);
  const [error, setError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.title}>{t(locale, "registerTitle")}</Text>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        <View style={styles.row}>
          {roles.map((item) => (
            <Pressable key={item} onPress={() => setRole(item)} style={[styles.ghost, { flex: 1, backgroundColor: role === item ? "#e6efe4" : "#fffdf8" }]}>
              <Text style={{ textAlign: "center", color: "#1c2416" }}>
                {t(locale, item === "BUSINESS_OWNER" ? "roleBusiness" : item === "DRIVER" ? "roleDriver" : "roleEmployee")}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={styles.input} placeholder={t(locale, "name")} value={name} onChangeText={setName} />
        <TextInput style={styles.input} autoCapitalize="none" placeholder={t(locale, "email")} value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder={t(locale, "password")} secureTextEntry value={password} onChangeText={setPassword} />
        {role === "EMPLOYEE" ? (
          <TextInput style={styles.input} autoCapitalize="characters" placeholder={t(locale, "inviteCode")} value={inviteCode} onChangeText={setInviteCode} />
        ) : null}
        {role === "BUSINESS_OWNER" ? (
          <>
            <TextInput style={styles.input} placeholder={t(locale, "businessName")} value={businessName} onChangeText={setBusinessName} />
            <TextInput style={styles.input} placeholder={t(locale, "address")} value={address} onChangeText={setAddress} />
            <Text style={styles.muted}>{t(locale, "pinHelp")}</Text>
            <View style={{ height: 240, borderRadius: 16, overflow: "hidden" }}>
              <Leaflet
                html={pickerHtml(lat, lng)}
                onMessage={(data) => {
                  const next = JSON.parse(data) as { lat: number; lng: number };
                  setLat(next.lat);
                  setLng(next.lng);
                }}
              />
            </View>
          </>
        ) : null}
        <Pressable
          style={styles.button}
          onPress={async () => {
            setError(null);
            try {
              const body = await session.api<{ token: string; user: User }>("/auth/register", {
                method: "POST",
                body: JSON.stringify({
                  email,
                  password,
                  name,
                  locale,
                  role,
                  inviteCode: role === "EMPLOYEE" ? inviteCode : undefined,
                  business: role === "BUSINESS_OWNER" ? { name: businessName, address, lat, lng } : undefined,
                }),
              });
              await session.login(body.token, body.user);
              router.replace(body.user.role === "DRIVER" ? "/driver" : body.user.role === "EMPLOYEE" ? "/employee" : "/register");
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
            }
          }}
        >
          <Text style={styles.buttonText}>{t(locale, "createAccount")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
