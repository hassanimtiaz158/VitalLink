import type { GeoPosition } from "./geolocation";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

/**
 * Geocode a free-text address to lat/lng via Nominatim (OpenStreetMap).
 *
 * Uses the `search` endpoint which accepts partial addresses, city names,
 * or structured queries. Returns the first result, or null if nothing found.
 */
export async function geocodeAddress(address: string): Promise<GeoPosition | null> {
  if (!address.trim()) return null;

  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
  });

  const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    headers: {
      // Nominatim usage policy requires a valid User-Agent.
      "User-Agent": "VitalLink/1.0 (hackathon demo)",
    },
  });

  if (!res.ok) return null;

  const results = await res.json();
  if (!results.length) return null;

  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
  };
}
