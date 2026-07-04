/**
 * Free-text address geocoding via Nominatim (OpenStreetMap).
 *
 * No API key required — uses the public Nominatim endpoint with a
 * User-Agent header as required by their usage policy.
 */
import type { GeoPosition } from "./geolocation";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

/**
 * Geocode a free-text address to lat/lng via Nominatim (OpenStreetMap).
 *
 * Returns the first result, or null if nothing found or the request fails.
 * Includes a timeout to prevent hanging on slow connections.
 */
export async function geocodeAddress(address: string): Promise<GeoPosition | null> {
  if (!address.trim()) return null;

  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: {
        "User-Agent": "VitalLink/1.0 (hackathon demo)",
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return null;

    const results = await res.json();
    if (!results.length) return null;

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    };
  } catch {
    return null;
  }
}
