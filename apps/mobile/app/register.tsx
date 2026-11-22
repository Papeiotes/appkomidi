import { t } from "@vardia/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Leaflet } from "../src/leaflet";
import { pickerHtml } from "../src/map-html";
import { explain, useSession, type User } from "../src/session";
import { colors, styles } from "../src/theme";

export default function RegisterScreen() {
  const session = useSession();
  const router = useRouter();
  const locale = session.locale;
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [afm, setAfm] = useState("");
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [lat, setLat] = useState(37.9838);
  const [lng, setLng] = useState(23.7275);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const titles = [t(locale, "businessName"), t(locale, "afm"), t(locale, "phone"), t(locale, "contactName"), t(locale, "street"), t(locale, "confirmPin"), t(locale, "username"), t(locale, "password"), t(locale, "review")];
  const value = [businessName, afm, phone, contact, street, "", username, password][step] ?? "";
  const setValue = [setBusinessName, setAfm, setPhone, setContact, setStreet, () => undefined, setUsername, setPassword][step];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={{ height: 6, backgroundColor: "#f4f7f5", borderRadius: 99 }}>
          <View style={{ width: `${((step + 1) / 9) * 100}%`, height: 6, backgroundColor: colors.olive, borderRadius: 99 }} />
        </View>
        <Text style={[styles.title, { marginTop: 18 }]}>{titles[step]}</Text>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        {step === 4 ? (
          <>
            <TextInput style={styles.input} placeholder={t(locale, "street")} value={street} onChangeText={setStreet} />
            <TextInput style={styles.input} placeholder={t(locale, "streetNumber")} value={number} onChangeText={setNumber} />
          </>
        ) : null}
        {step === 5 ? (
          <View style={{ height: 280 }}>
            <Leaflet html={pickerHtml(lat, lng)} onMessage={(data) => { const next = JSON.parse(data) as { lat: number; lng: number }; setLat(next.lat); setLng(next.lng); }} />
          </View>
        ) : null}
        {step !== 4 && step !== 5 && step !== 8 ? (
          <TextInput style={styles.input} secureTextEntry={step === 7} value={value} onChangeText={setValue} />
        ) : null}
        {step === 8 ? <Text style={{ fontSize: 18 }}>{businessName}{"\n"}{street} {number}</Text> : null}
        <View style={[styles.row, { marginTop: 20 }]}>
          {step > 0 ? <Pressable style={styles.ghost} onPress={() => setStep(step - 1)}><Text>{t(locale, "back")}</Text></Pressable> : null}
          <Pressable style={[styles.button, { flex: 1 }]} onPress={() => {
            if (step < 8) setStep(step + 1);
            else void session.api<{ token: string; user: User }>("/auth/register", {
              method: "POST",
              body: JSON.stringify({ username, password, businessName, afm, phone, contactName: contact, street, streetNumber: number, addressLabel: `${street} ${number}`, lat, lng, locale }),
            }).then(async (body) => {
              await session.login(body.token, body.user);
              router.replace("/shop");
            }).catch((caught) => setError(caught instanceof Error ? caught.message : "REQUEST_FAILED"));
          }}>
            <Text style={styles.buttonText}>{step === 8 ? t(locale, "createAccount") : t(locale, "next")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
