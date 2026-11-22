"use client";

import { useRef } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMapEvents } from "react-leaflet";

function CornerClicks({ onAdd }: { onAdd: (lng: number, lat: number) => void }) {
  const dragged = useRef(false);
  useMapEvents({
    dragstart() {
      dragged.current = true;
    },
    dragend() {
      window.setTimeout(() => {
        dragged.current = false;
      }, 80);
    },
    click(event) {
      if (dragged.current) return;
      onAdd(event.latlng.lng, event.latlng.lat);
    },
  });
  return null;
}

/** Corners come only from a click. Panning and zooming do not add points. */
export function PolygonDraw({
  ring,
  onAdd,
}: {
  ring: [number, number][];
  onAdd: (lng: number, lat: number) => void;
}) {
  const positions = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
  return (
    <div className="h-80 overflow-hidden rounded-2xl border border-border">
      <MapContainer center={[37.975, 23.73]} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CornerClicks onAdd={onAdd} />
        {positions.length >= 3 ? (
          <Polygon positions={positions} pathOptions={{ color: "#1b7f4a", weight: 2, fillOpacity: 0.15 }} />
        ) : positions.length >= 2 ? (
          <Polyline positions={positions} pathOptions={{ color: "#1b7f4a", weight: 3 }} />
        ) : null}
        {positions.map((position, index) => (
          <CircleMarker key={`${position[0]}-${position[1]}-${index}`} center={position} radius={6} pathOptions={{ color: "#1b7f4a", fillColor: "#1b7f4a", fillOpacity: 1 }} />
        ))}
      </MapContainer>
    </div>
  );
}
