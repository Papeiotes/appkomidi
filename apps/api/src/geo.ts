import { HttpError } from "./http";
import { env } from "./env";

const cache = new Map<string, { at: number; body: unknown }>();
let lastCall = 0;

async function nominatim(path: string) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.body;
  const wait = Math.max(0, 1100 - (Date.now() - lastCall));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
  const response = await fetch(`${env.nominatimUrl}${path}`, {
    headers: {
      "User-Agent": "Vardia/0.1 (hackathon demo; admin@vardia.gr)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new HttpError(502, "GEO_UNAVAILABLE");
  const body: unknown = await response.json();
  cache.set(path, { at: Date.now(), body });
  if (cache.size > 100) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return body;
}

export async function searchAddress(query: string) {
  const path = `/search?format=jsonv2&limit=5&countrycodes=gr&q=${encodeURIComponent(query)}`;
  const body = (await nominatim(path)) as { display_name?: string; lat?: string; lon?: string }[];
  return (Array.isArray(body) ? body : []).map((row) => ({
    label: row.display_name ?? "",
    lat: Number(row.lat),
    lng: Number(row.lon),
  }));
}

export async function reverseAddress(lat: number, lng: number) {
  const path = `/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const body = (await nominatim(path)) as { display_name?: string };
  return { label: body.display_name ?? "", lat, lng };
}
