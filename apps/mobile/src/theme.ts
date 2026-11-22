import { StyleSheet } from "react-native";

export const colors = {
  paper: "#ffffff",
  card: "#ffffff",
  ink: "#142018",
  muted: "#5c6b62",
  line: "#e3ebe6",
  olive: "#1b7f4a",
  cream: "#ffffff",
  amber: "#1b7f4a",
  danger: "#9d3b2c",
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 16, gap: 12 },
  title: { fontSize: 32, color: colors.ink, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
  button: { backgroundColor: colors.olive, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: colors.cream, fontWeight: "600" },
  ghost: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 10, alignItems: "center", backgroundColor: colors.card },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  error: { backgroundColor: "#f8e6e2", color: colors.danger, padding: 10, borderRadius: 10 },
});
