export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export type GeoError =
  | { type: "unsupported" }
  | { type: "denied" }
  | { type: "unavailable" }
  | { type: "timeout" }
  | { type: "unknown" };

/**
 * Attempt to get the user's current position via the browser Geolocation API.
 * Returns the position on success, or a GeoError describing why it failed.
 */
export async function getCurrentPosition(): Promise<
  { position: GeoPosition; error: null } | { position: null; error: GeoError }
> {
  if (!navigator.geolocation) {
    return { position: null, error: { type: "unsupported" } };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          position: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
          error: null,
        });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            resolve({ position: null, error: { type: "denied" } });
            break;
          case err.POSITION_UNAVAILABLE:
            resolve({ position: null, error: { type: "unavailable" } });
            break;
          case err.TIMEOUT:
            resolve({ position: null, error: { type: "timeout" } });
            break;
          default:
            resolve({ position: null, error: { type: "unknown" } });
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 },
    );
  });
}

/** Human-readable error message for each GeoError type. */
export function geoErrorMessage(err: GeoError): string {
  switch (err.type) {
    case "unsupported":
      return "Geolocation is not supported by your browser. Please enter your address manually.";
    case "denied":
      return "Location access was denied. Please enter your address below.";
    case "unavailable":
      return "Your location could not be determined. Please enter your address below.";
    case "timeout":
      return "Location request timed out. Please enter your address below.";
    case "unknown":
      return "An unexpected error occurred getting your location. Please enter your address below.";
  }
}
