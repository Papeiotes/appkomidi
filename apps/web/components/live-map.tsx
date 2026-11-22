"use client";

import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import L from "leaflet";

const van = L.divIcon({
  className: "",
  html: '<span style="display:block;width:16px;height:16px;margin-left:-8px;margin-top:-8px;border-radius:999px;background:#e39b2b;border:3px solid #1c2416"></span>',
  iconSize: [0, 0],
});

const stop = L.divIcon({
  className: "",
  html: '<span style="display:block;width:12px;height:12px;margin-left:-6px;margin-top:-6px;border-radius:999px;background:#2f4a34;border:2px solid #f7f4ec"></span>',
  iconSize: [0, 0],
});

export function LiveMap({
  driver,
  line,
  stops,
}: {
  driver: { lat: number; lng: number } | null;
  line: [number, number][];
  stops: { lat: number; lng: number; label: string }[];
}) {
  const center = driver ?? stops[0] ?? { lat: 37.9838, lng: 23.7275 };
  return (
    <div className="h-80 overflow-hidden rounded-xl border border-border md:h-[28rem]">
      <MapContainer center={[center.lat, center.lng]} zoom={14} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {line.length > 1 ? <Polyline positions={line} pathOptions={{ color: "#2f4a34", weight: 4 }} /> : null}
        {stops.map((point) => (
          <Marker key={`${point.lat}-${point.lng}-${point.label}`} position={[point.lat, point.lng]} icon={stop} />
        ))}
        {driver ? <Marker position={[driver.lat, driver.lng]} icon={van} /> : null}
      </MapContainer>
    </div>
  );
}
