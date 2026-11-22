import { t } from "@vardia/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Leaflet } from "../src/leaflet";
import { pickerHtml } from "../src/map-html";
import { explain, useSession, type User } from "../src/session";
import { styles } from "../src/theme";

export default function RegisterScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [afm, setAfm] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [street, setStreet] = useState("Σταδίου");
  const [streetNumber, setStreetNumber] = useState("1");
  const [lat, setLat] = useState(37.9838);
  const [lng, setLng] = useState(23.7275);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.title}>{t(locale, "registerTitle")}</Text>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        <TextInput style={styles.input} placeholder={t(locale, "businessName")} value={businessName} onChangeText={setBusinessName} />
        <TextInput style={styles.input} placeholder={t(locale, "afm")} value={afm} onChangeText={setAfm} />
        <TextInput style={styles.input} placeholder={t(locale, "phone")} value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder={t(locale, "contactName")} value={contactName} onChangeText={setContactName} />
        <TextInput style={styles.input} autoCapitalize="none" placeholder={t(locale, "username")} value={username} onChangeText={setUsername} />
        <TextInput style={styles.input} secureTextEntry placeholder={t(locale, "password")} value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} placeholder={t(locale, "street")} value={street} onChangeText={setStreet} />
        <TextInput style={styles.input} placeholder={t(locale, "streetNumber")} value={streetNumber} onChangeText={setStreetNumber} />
        <Text style={styles.muted}>{t(locale, "pinHelp")}</Text>
        <SafeAreaView style={{ height: 220 }}>
          <Leaflet
            html={pickerHtml(lat, lng)}
            onMessage={(data) => {
              const next = JSON.parse(data) as { lat: number; lng: number };
              setLat(next.lat);
              setLng(next.lng);
              setConfirmed(false);
            }}
          />
        </SafeAreaView>
        <Pressable style={styles.ghost} onPress={() => setConfirmed(true)}>
          <Text style={{ textAlign: "center" }}>{confirmed ? t(locale, "pinConfirmed") : t(locale, "confirmPin")}</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={async () => {
            if (!confirmed) {
              setError("BAD_INPUT");
              return;
            }
            setError(null);
            try {
              const body = await session.api<{ token: string; user: User }>("/auth/register", {
                method: "POST",
                body: JSON.stringify({
                  username,
                  password,
                  businessName,
                  afm,
                  phone,
                  contactName,
                  street,
                  streetNumber,
                  addressLabel: `${street} ${streetNumber}`,
                  lat,
                  lng,
                  locale,
                }),
              });
              await session.login(body.token, body.user);
              router.replace("/shop");
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
