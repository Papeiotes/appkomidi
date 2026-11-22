import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "APPkomidi",
  slug: "appkomidi",
  owner: "papeiotess-team",
  scheme: "appkomidi",
  android: {
    ...config.android,
    package: "gr.appkomidi.app",
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
  },
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#1b7f4a",
  },
  extra: {
    ...config.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4107",
  },
});
