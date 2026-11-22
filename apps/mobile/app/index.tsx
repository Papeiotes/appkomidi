import { t } from "@vardia/shared";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { explain, useSession, type User } from "../src/session";
import { styles } from "../src/theme";

export default function LoginScreen() {
  const session = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const locale = session.locale;

  useEffect(() => {
    if (!session.ready || !session.user) return;
    if (session.user.role === "DRIVER") router.replace("/driver");
    else if (session.user.role === "EMPLOYEE") router.replace("/employee");
    else router.replace("/register");
  }, [session.ready, session.user, router]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pad}>
        <View style={styles.row}>
          <Text style={styles.title}>{t(locale, "brand")}</Text>
          <Pressable onPress={() => session.setLocale(locale === "el" ? "en" : "el")}>
            <Text>{locale === "el" ? "EN" : "ΕΛ"}</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>{t(locale, "loginBody")}</Text>
        {error ? <Text style={styles.error}>{explain(locale, error)}</Text> : null}
        <TextInput style={styles.input} autoCapitalize="none" placeholder={t(locale, "email")} value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder={t(locale, "password")} secureTextEntry value={password} onChangeText={setPassword} />
        <Text style={styles.muted}>{t(locale, "apiUrl")}</Text>
        <TextInput style={styles.input} autoCapitalize="none" value={session.apiUrl} onChangeText={session.setApiUrl} />
        <Text style={styles.muted}>{t(locale, "apiUrlHint")}</Text>
        <Pressable
          style={styles.button}
          onPress={async () => {
            setError(null);
            try {
              const body = await session.api<{ token: string; user: User }>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
              });
              await session.login(body.token, body.user);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
            }
          }}
        >
          <Text style={styles.buttonText}>{t(locale, "signIn")}</Text>
        </Pressable>
        <Link href="/register" style={{ color: colorsLink }}>
          {t(locale, "registerTitle")}
        </Link>
        <Text style={styles.muted}>{t(locale, "demoHint")}</Text>
      </View>
    </SafeAreaView>
  );
}

const colorsLink = "#2f4a34";
