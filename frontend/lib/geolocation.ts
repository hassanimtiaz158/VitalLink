export interface GeoPosition {
  latitude: number;
  longitude: number;
}

/**
 * Attempt to get the user's current position via the browser Geolocation API.
 * Returns null if the user denies permission or the device doesn't support it.
 */
export function getCurrentPosition(): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        // Permission denied or position unavailable — fall back to manual.
        resolve(null);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  });
}
