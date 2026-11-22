"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

const van = L.divIcon({
  className: "",
  html: '<span style="display:block;width:18px;height:18px;margin-left:-9px;margin-top:-9px;border-radius:999px;background:#1b7f4a;border:3px solid #ffffff;box-shadow:0 0 0 6px rgba(27,127,74,.28)"></span>',
  iconSize: [0, 0],
});

const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:14px;height:14px;margin-left:-7px;margin-top:-7px;border-radius:999px;background:#ffffff;border:3px solid #1b7f4a"></span>',
  iconSize: [0, 0],
});

const activePin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:22px;height:22px;margin-left:-11px;margin-top:-11px;border-radius:999px;background:#1b7f4a;border:3px solid #e39b2b;box-shadow:0 0 0 7px rgba(227,155,43,.35)"></span>',
  iconSize: [0, 0],
});

function FrameStops({ points, signature }: { points: [number, number][]; signature: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) {
      map.setView([37.9838, 23.7275], 13, { animate: false });
      return;
    }
    if (points.length === 1) map.setView(points[0], 15, { animate: false });
    else map.fitBounds(points, { paddingTopLeft: [48, 72], paddingBottomRight: [48, 240], maxZoom: 16, animate: false });
  }, [signature, map]);
  return null;
}

export function LiveMap({
  driver,
  line,
  stops,
  className,
}: {
  driver: { lat: number; lng: number } | null;
  line: [number, number][];
  stops: { id?: string; lat: number; lng: number; label: string; active?: boolean }[];
  className?: string;
}) {
  const center = stops[0] ?? driver ?? { lat: 37.9838, lng: 23.7275 };
  const signature = stops.map((stop) => stop.id ?? `${stop.lat},${stop.lng}`).join("|");
  const points = stops.map((stop) => [stop.lat, stop.lng] as [number, number]);
  return (
    <div className={className ?? "h-80 overflow-hidden rounded-xl border border-border md:h-[28rem]"}>
      <MapContainer center={[center.lat, center.lng]} zoom={13} className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FrameStops points={points} signature={signature} />
        {line.length > 1 ? <Polyline positions={line} pathOptions={{ color: "#1b7f4a", weight: 5 }} /> : null}
        {stops.map((point) => (
          <Marker key={point.id ?? `${point.lat}-${point.lng}`} position={[point.lat, point.lng]} icon={point.active ? activePin : pin} title={point.label} />
        ))}
        {driver ? <Marker position={[driver.lat, driver.lng]} icon={van} /> : null}
      </MapContainer>
    </div>
  );
}
