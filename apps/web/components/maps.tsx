"use client";

import dynamic from "next/dynamic";

export const MapPicker = dynamic(() => import("./map-picker").then((mod) => mod.MapPicker), {
  ssr: false,
});

export const LiveMap = dynamic(() => import("./live-map").then((mod) => mod.LiveMap), {
  ssr: false,
});
