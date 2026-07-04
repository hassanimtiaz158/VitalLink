"use client";

import { FormEvent, useState } from "react";
import { getCurrentPosition } from "@/lib/geolocation";
import { geocodeAddress } from "@/lib/geocode";
import { registerDonor, type DonorResponse } from "@/lib/api";

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

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  async function tryGeolocation(): Promise<boolean> {
    setStatus({ state: "locating" });
    const pos = await getCurrentPosition();
    if (pos) {
      setLat(pos.latitude);
      setLng(pos.longitude);
      return true;
    }
    return false;
  }

  async function tryGeocode(): Promise<boolean> {
    if (!manualAddress.trim()) return false;
    setStatus({ state: "geocoding" });
    const pos = await geocodeAddress(manualAddress);
    if (pos) {
      setLat(pos.latitude);
      setLng(pos.longitude);
      return true;
    }
    return false;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // 1. Try browser geolocation first.
    let located = await tryGeolocation();

    // 2. Fall back to manual address geocoding.
    if (!located) {
      located = await tryGeocode();
    }

    if (!located) {
      setStatus({
        state: "error",
        message: "Could not determine location. Please enter a valid address.",
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
      setStatus({ state: "success", donor });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message ?? "Registration failed" });
    }
  }

  if (status.state === "success") {
    return (
      <div style={cardStyle}>
        <h2 style={headingStyle}>Registered!</h2>
        <p>Thanks, <strong>{status.donor.name}</strong>. You&apos;re now in the donor pool.</p>
        <p>Blood type: <strong>{status.donor.blood_type}</strong></p>
        <button
          onClick={() => {
            setStatus({ state: "idle" });
            setName("");
            setEmail("");
            setManualAddress("");
            setLat(null);
            setLng(null);
          }}
          style={btnSecondary}
        >
          Register Another
        </button>
      </div>
    );
  }

  const isBusy = status.state === "locating" || status.state === "geocoding" || status.state === "submitting";

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <h2 style={headingStyle}>Donor Registration</h2>

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
        Address (fallback if browser location denied)
        <input
          type="text"
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
          style={inputStyle}
          placeholder="123 Main St, Springfield, IL"
        />
      </label>

      {/* Location preview */}
      {lat !== null && lng !== null && (
        <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>
          Location: {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      )}

      {/* Error */}
      {status.state === "error" && (
        <p style={{ color: "#dc2626", margin: "0.5rem 0" }}>{status.message}</p>
      )}

      <button type="submit" disabled={isBusy} style={btnPrimary}>
        {status.state === "locating" && "Detecting location\u2026"}
        {status.state === "geocoding" && "Looking up address\u2026"}
        {status.state === "submitting" && "Registering\u2026"}
        {status.state === "idle" && "Register as Donor"}
        {status.state === "error" && "Try Again"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (no Tailwind dependency for hackathon speed)
// ---------------------------------------------------------------------------
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
  backgroundColor: "#dc2626",
  color: "#fff",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "0.5rem",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  backgroundColor: "#6b7280",
  marginTop: "1rem",
};
