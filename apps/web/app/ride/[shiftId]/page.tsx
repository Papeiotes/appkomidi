import { Suspense } from "react";
import Screen from "./screen";

export default function Page() {
  return (
    <Suspense fallback={<p className="px-4 py-6">…</p>}>
      <Screen />
    </Suspense>
  );
}
