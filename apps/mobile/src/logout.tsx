import { t } from "@vardia/shared";
import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { useSession } from "./session";
import { colors } from "./theme";

export function LogoutButton() {
  const session = useSession();
  const router = useRouter();
  return (
    <Pressable
      hitSlop={8}
      accessibilityRole="button"
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: "#fff" }}
      onPress={() => {
        void session.logout().then(() => router.replace("/"));
      }}
    >
      <Text style={{ fontWeight: "600", color: colors.ink }}>{t(session.locale, "logout")}</Text>
    </Pressable>
  );
}
