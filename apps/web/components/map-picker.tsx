"use client";

import { t, type Locale } from "@vardia/shared";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:18px;height:18px;margin-left:-9px;margin-top:-9px;border-radius:999px;background:#2f4a34;border:3px solid #f7f4ec;box-shadow:0 0 0 6px rgba(227,155,43,.45)"></span>',
  iconSize: [0, 0],
});

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export function MapPicker({
  locale,
  lat,
  lng,
  onChange,
  token,
}: {
  locale: Locale;
  lat: number;
  lng: number;
  onChange: (next: { lat: number; lng: number; label?: string }) => void;
  token?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const center = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);

  useEffect(() => {
    if (!token || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api<{ results: { label: string; lat: number; lng: number }[] }>(
        `/geo/search?q=${encodeURIComponent(query.trim())}`,
        {},
        token,
      )
        .then((body) => setResults(body.results))
        .catch(() => setResults([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [query, token]);

  return (
    <div className="grid gap-2">
      <Input
        value={query}
        placeholder={t(locale, "searchAddress")}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length > 0 ? (
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {results.map((result) => (
            <li key={`${result.lat}-${result.lng}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(result);
                  setQuery(result.label);
                  setResults([]);
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 3 ? (
        <p className="text-xs text-muted-foreground">{t(locale, "searchEmpty")}</p>
      ) : null}
      <div className="h-72 overflow-hidden rounded-xl border border-border">
        <MapContainer center={center} zoom={14} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter lat={lat} lng={lng} />
          <ClickCatcher onPick={(nextLat, nextLng) => onChange({ lat: nextLat, lng: nextLng })} />
          <Marker
            position={center}
            icon={pin}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const next = event.target.getLatLng();
                onChange({ lat: next.lat, lng: next.lng });
              },
            }}
          />
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </div>
  );
}
