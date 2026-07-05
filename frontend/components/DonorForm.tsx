/**
 * DonorForm — Registration form for new blood donors.
 *
 * Captures name, blood type, email, and geolocation (auto-detected or
 * manual address fallback via Nominatim). Submits to POST /donors.
 */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentPosition, geoErrorMessage, type GeoError } from "@/lib/geolocation";
import { geocodeAddress } from "@/lib/geocode";
import { registerDonor, type DonorResponse } from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";

const BLOOD_TYPES = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];

type Status =
  | { state: "idle" }
  | { state: "locating" }
  | { state: "geocoding" }
  | { state: "submitting" }
  | { state: "success"; donor: DonorResponse }
  | { state: "error"; message: string };

export default function DonorForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bloodType, setBloodType] = useState("O+");
  const [available, setAvailable] = useState(true);
  const [manualAddress, setManualAddress] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [geoError, setGeoError] = useState<GeoError | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  async function tryGeolocation(): Promise<boolean> {
    setStatus({ state: "locating" });
    setGeoError(null);
    const result = await getCurrentPosition();
    if (result.position) {
      setLat(result.position.latitude);
      setLng(result.position.longitude);
      setGeoError(null);
      return true;
    }
    setGeoError(result.error);
    return false;
  }

  async function tryGeocode(): Promise<boolean> {
    if (!manualAddress.trim()) return false;
    setStatus({ state: "geocoding" });
    const pos = await geocodeAddress(manualAddress);
    if (pos) {
      setLat(pos.latitude);
      setLng(pos.longitude);
      setGeoError(null);
      return true;
    }
    return false;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // 1. Try browser geolocation first (may fail on localhost / HTTP).
    let located = await tryGeolocation();

    // 2. Fall back to manual address geocoding.
    if (!located && manualAddress.trim()) {
      located = await tryGeocode();
    }

    if (!located) {
      setStatus({
        state: "error",
        message: geoError
          ? geoErrorMessage(geoError)
          : "Could not determine location. Please enter your address below and try again.",
      });
      return;
    }

      setStatus({ state: "submitting" });

    try {
      const donor = await registerDonor({
        name,
        email,
        blood_type: bloodType,
        latitude: lat!,
        longitude: lng!,
        available,
      });
      // Set localStorage immediately so dashboard guard can find it
      localStorage.setItem("vitallink_donor_id", donor.donor_id);
      setStatus({ state: "success", donor });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message ?? "Registration failed" });
    }
  }

  if (status.state === "success") {
    return (
      <div style={cardStyle}>
        <SuccessCard donor={status.donor} />
      </div>
    );
  }

  const isBusy = status.state === "locating" || status.state === "geocoding" || status.state === "submitting";

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <h2 style={headingStyle}>Donor Registration</h2>

      {/* Location hint for localhost */}
      {typeof window !== "undefined" && window.location.protocol === "http:" && (
        <p style={{ fontSize: "0.8rem", color: "#5C6D66", backgroundColor: "#F0FAF8", padding: "0.5rem 0.75rem", borderRadius: 6, margin: "0 0 1rem", lineHeight: 1.4 }}>
          Running on localhost? Browser location may be unavailable. Enter your address manually below.
        </p>
      )}

      {/* Name */}
      <label style={labelStyle}>
        Full Name
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="Jane Doe"
        />
      </label>

      {/* Email */}
      <label style={labelStyle}>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          placeholder="jane@example.com"
        />
      </label>

      {/* Blood Type */}
      <label style={labelStyle}>
        Blood Type
        <select
          value={bloodType}
          onChange={(e) => setBloodType(e.target.value)}
          style={inputStyle}
        >
          {BLOOD_TYPES.map((bt) => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
      </label>

      {/* Availability Toggle */}
      <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: "0.75rem" }}>
        Available to donate
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: "#dc2626" }}
        />
      </label>

      {/* Manual Address Fallback */}
      <label style={labelStyle}>
        Address {geoError && <span style={{ fontWeight: 400, color: "#92400e" }}>(required — browser location unavailable on this device)</span>}
        <input
          type="text"
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
          style={{
            ...inputStyle,
            borderColor: geoError ? "#f59e0b" : undefined,
            backgroundColor: geoError ? "#FFFBEB" : undefined,
          }}
          placeholder="e.g. Mount Sinai Hospital, New York, NY"
          required={!!geoError}
        />
        {geoError && (
          <span style={{ fontSize: "0.75rem", color: "#92400e", marginTop: "0.25rem" }}>
            Enter a hospital or street address so we can match you with nearby requests.
          </span>
        )}
      </label>

      {/* Location preview */}
      {lat !== null && lng !== null && (
        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 0.5rem" }}>
          &#10003; Location acquired: {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      )}

      {/* Geolocation guidance */}
      {geoError && status.state !== "error" && (
        <p style={{ fontSize: "0.8rem", color: "#92400e", margin: "0 0 0.5rem", backgroundColor: "#fef3c7", padding: "0.5rem 0.75rem", borderRadius: 6 }}>
          {geoErrorMessage(geoError)}
        </p>
      )}

      {/* Error */}
      {status.state === "error" && (
        <div style={{ backgroundColor: "#FBEAEA", border: "2px solid #F5D0D0", borderRadius: 8, padding: "1rem 1.25rem", margin: "0.5rem 0" }}>
          <p style={{ color: "#7A0A1D", margin: 0, fontSize: "0.9rem", fontWeight: 500 }}>{status.message}</p>
          {!manualAddress.trim() && (
            <p style={{ color: "#7A0A1D", margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
              Tip: Enter your address below so we can locate you without browser location access.
            </p>
          )}
        </div>
      )}

      <button type="submit" disabled={isBusy} style={btnPrimary}>
        {status.state === "locating" && <LoadingSpinner label="Detecting location\u2026" />}
        {status.state === "geocoding" && <LoadingSpinner label="Looking up address\u2026" />}
        {status.state === "submitting" && <LoadingSpinner label="Registering\u2026" />}
        {status.state === "idle" && "Register as Donor"}
        {status.state === "error" && "Try Again"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------

function SuccessCard({ donor }: { donor: DonorResponse }) {
  const router = useRouter();

  function goToDashboard() {
    localStorage.setItem("vitallink_donor_id", donor.donor_id);
    router.push("/donate/dashboard");
  }

  return (
    <>
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>&#10003;</div>
        <h2 style={headingStyle}>Registered!</h2>
        <p>Thanks, <strong>{donor.name}</strong>. You&apos;re now in the donor pool.</p>
        <p>Blood type: <strong>{donor.blood_type}</strong></p>
        <p style={{ fontSize: "0.8rem", color: "#5C6D66" }}>
          Your donor ID: <code style={{ backgroundColor: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>{donor.donor_id}</code>
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <button onClick={goToDashboard} style={btnPrimary}>
          View your dashboard
        </button>
      </div>
    </>
  );
}
const cardStyle: React.CSSProperties = {
  maxWidth: 480,
  margin: "2rem auto",
  padding: "2rem",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  fontFamily: "system-ui, sans-serif",
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 1.5rem",
  fontSize: "1.5rem",
  fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  marginBottom: "1rem",
  fontSize: "0.9rem",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "1rem",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  border: "none",
  borderRadius: 8,
  backgroundColor: "#1B7F79",
  color: "#fff",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "0.5rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  minHeight: 44,
  textDecoration: "none",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  backgroundColor: "#6b7280",
  marginTop: "1rem",
};
