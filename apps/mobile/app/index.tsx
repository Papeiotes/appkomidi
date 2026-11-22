import { t } from "@vardia/shared";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { explain, useSession, type User } from "../src/session";
import { colors, styles } from "../src/theme";

export default function LoginScreen() {
  const session = useSession();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const locale = session.locale;

  useEffect(() => {
    if (!session.ready || !session.user) return;
    const role = session.user.role;
    router.replace(role === "DRIVER" ? "/driver" : role === "OFFICE" || role === "ADMIN" ? "/staff" : "/shop");
  }, [session.ready, session.user, router]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ height: 168 }}>
        <Image source={require("../assets/athens.webp")} style={{ width: "100%", height: 168 }} resizeMode="cover" />
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(27,127,74,0.5)", justifyContent: "flex-end", padding: 16 }}>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>{t(locale, "brand")}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 4 }}>{t(locale, "photoCredit")}</Text>
        </View>
      </View>
      <View style={styles.pad}>
        <View style={styles.row}>
          <Text style={{ color: colors.olive, fontWeight: "600" }}>{t(locale, "cityBrand")}</Text>
          <Pressable hitSlop={12} style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }} onPress={() => session.setLocale(locale === "el" ? "en" : "el")}>
            <Text>{locale === "el" ? "EN" : "ΕΛ"}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        <TextInput style={styles.input} autoCapitalize="none" placeholder={t(locale, "username")} value={username} onChangeText={setUsername} />
        <TextInput style={styles.input} placeholder={t(locale, "password")} secureTextEntry value={password} onChangeText={setPassword} />
        <Text style={styles.muted}>{t(locale, "apiUrl")}</Text>
        <TextInput style={styles.input} autoCapitalize="none" value={session.apiUrl} onChangeText={session.setApiUrl} />
        <Text style={styles.muted}>{t(locale, "apiUrlHint")}</Text>
        <Pressable
          hitSlop={8}
          style={styles.button}
          onPress={async () => {
            setError(null);
            try {
              const body = await session.api<{ token: string; user: User }>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
              });
              await session.login(body.token, body.user);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
            }
          }}
        >
          <Text style={styles.buttonText}>{t(locale, "signIn")}</Text>
        </Pressable>
        <Link href="/register" style={{ color: colors.olive, minHeight: 44, textAlign: "center", paddingVertical: 12 }}>
          {t(locale, "ctaRegister")}
        </Link>
        <Text style={styles.muted}>{t(locale, "demoHint")}</Text>
      </View>
    </SafeAreaView>
  );
}
