import { forwardRef, type ComponentType, type Ref } from "react";
import { WebView, type WebView as WebViewType } from "react-native-webview";

type Props = {
  html: string;
  onMessage?: (data: string) => void;
};

const NativeWebView = WebView as unknown as ComponentType<{
  ref?: Ref<WebViewType>;
  originWhitelist?: string[];
  source?: { html: string };
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  style?: { flex: number };
}>;

export const Leaflet = forwardRef<WebViewType, Props>(function Leaflet({ html, onMessage }, ref) {
  return (
    <NativeWebView
      ref={ref}
      originWhitelist={["*"]}
      source={{ html }}
      style={{ flex: 1 }}
      onMessage={onMessage ? (event) => onMessage(event.nativeEvent.data) : undefined}
    />
  );
});
