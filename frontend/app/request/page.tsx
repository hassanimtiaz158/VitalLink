/**
 * Request landing page — register as a requester and create a blood request.
 *
 * URL: /request
 * After successful submission, redirects to /request/dashboard with the request ID.
 */
"use client";

import { FormEvent, useState, useEffect } from "react";
import { getCurrentPosition, geoErrorMessage, type GeoError } from "@/lib/geolocation";
import { geocodeAddress } from "@/lib/geocode";
import {
  registerRequester,
  createRequest,
  type RequesterResponse,
  type RequestResponse,
} from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";

const BLOOD_TYPES = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
const URGENCY = ["critical", "high", "routine"];
const RED = "#C8102E";

type Phase =
  | { step: "idle" }
  | { step: "locating" }
  | { step: "geocoding" }
  | { step: "submitting" }
  | { step: "success"; requester: RequesterResponse; request: RequestResponse }
  | { step: "error"; message: string };

export default function RequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodType, setBloodType] = useState("O+");
  const [unitsNeeded, setUnitsNeeded] = useState(2);
  const [urgency, setUrgency] = useState("critical");
  const [manualAddress, setManualAddress] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [geoError, setGeoError] = useState<GeoError | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Check for returning requester
  useEffect(() => {
    const rid = localStorage.getItem("vitallink_requester_id");
    const rname = localStorage.getItem("vitallink_requester_name");
    if (rid && rname) {
      setName(rname);
    }
    const remail = localStorage.getItem("vitallink_requester_email");
    if (remail) setEmail(remail);
  }, []);

  async function tryGeolocation(): Promise<{ latitude: number; longitude: number } | null> {
    setPhase({ step: "locating" });
    setGeoError(null);
    const result = await getCurrentPosition();
    if (result.position) {
      setLat(result.position.latitude);
      setLng(result.position.longitude);
      setGeoError(null);
      return result.position;
    }
    setGeoError(result.error);
    return null;
  }

  async function tryGeocode(): Promise<{ latitude: number; longitude: number } | null> {
    if (!manualAddress.trim()) return null;
    setPhase({ step: "geocoding" });
    const pos = await geocodeAddress(manualAddress);
    if (pos) {
      setLat(pos.latitude);
      setLng(pos.longitude);
      setGeoError(null);
      return pos;
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    let location = await tryGeolocation();
    if (!location && manualAddress.trim()) {
      location = await tryGeocode();
    }

    if (!location) {
      setPhase({
        step: "error",
        message: geoError
          ? geoErrorMessage(geoError)
          : "Could not determine location. Please enter your address and try again.",
      });
      return;
    }

    setPhase({ step: "submitting" });

    try {
      let requesterId = localStorage.getItem("vitallink_requester_id");

      let requester: RequesterResponse;
      if (requesterId) {
        // Re-use existing requester
        requester = {
          requester_id: requesterId,
          name,
          email,
          phone: phone || null,
          latitude: location.latitude,
          longitude: location.longitude,
          created_at: new Date().toISOString(),
        };
      } else {
        requester = await registerRequester({
          name,
          email,
          phone: phone || null,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        localStorage.setItem("vitallink_requester_id", requester.requester_id);
        localStorage.setItem("vitallink_requester_name", name);
        localStorage.setItem("vitallink_requester_email", email);
      }

      const request = await createRequest({
        requester_id: requester.requester_id,
        blood_type: bloodType,
        units_needed: unitsNeeded,
        urgency,
      });

      setPhase({ step: "success", requester, request });
    } catch (err: any) {
      if (
        err.message?.includes("Requester not found") &&
        localStorage.getItem("vitallink_requester_id")
      ) {
        localStorage.removeItem("vitallink_requester_id");
        localStorage.removeItem("vitallink_requester_name");
        localStorage.removeItem("vitallink_requester_email");
      }
      setPhase({ step: "error", message: err.message ?? "Request failed" });
    }
  }

  if (phase.step === "success") {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>&#10003;</div>
            <h2 style={headingStyle}>Request submitted!</h2>
            <p>
              <strong>{phase.request.blood_type}</strong> &middot; {phase.request.units_needed} unit{phase.request.units_needed !== 1 ? "s" : ""}
            </p>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: "0.5rem 0 1rem", lineHeight: 1.5 }}>
              We found candidate donors near you. Review them in your dashboard and accept the ones you want.
            </p>
          </div>
          <a href={`/request/dashboard?id=${phase.request.request_id}`} style={btnPrimary}>
            View candidate donors
          </a>
        </div>
      </div>
    );
  }

  const isBusy = phase.step === "locating" || phase.step === "geocoding" || phase.step === "submitting";

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={iconWrap}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 32, height: 32 }}>
              <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
            </svg>
          </div>
          <h2 style={headingStyle}>I need blood</h2>
          <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
            Tell us what you need and we will find compatible donors nearby.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <label style={labelStyle}>
            Your name
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

          {/* Phone */}
          <label style={labelStyle}>
            Phone <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
              placeholder="+92 300 1234567"
            />
          </label>

          {/* Blood Type + Urgency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label style={labelStyle}>
              Blood type needed
              <select value={bloodType} onChange={(e) => setBloodType(e.target.value)} style={inputStyle}>
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Urgency
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} style={inputStyle}>
                {URGENCY.map((u) => (
                  <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Units needed */}
          <label style={labelStyle}>
            Units needed
            <input
              type="number"
              min={1}
              max={10}
              value={unitsNeeded}
              onChange={(e) => setUnitsNeeded(Number(e.target.value))}
              style={inputStyle}
            />
          </label>

          {/* Address */}
          {typeof window !== "undefined" && window.location.protocol === "http:" && (
            <p style={{ fontSize: "0.8rem", color: "#5C6D66", backgroundColor: "#F0FAF8", padding: "0.5rem 0.75rem", borderRadius: 6, margin: "0 0 0.75rem", lineHeight: 1.4 }}>
              Running on localhost? Browser location may be unavailable. Enter your address manually.
            </p>
          )}

          <label style={labelStyle}>
            Address {geoError && <span style={{ fontWeight: 400, color: "#92400e" }}>(required)</span>}
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              style={{
                ...inputStyle,
                borderColor: geoError ? "#f59e0b" : undefined,
                backgroundColor: geoError ? "#FFFBEB" : undefined,
              }}
              placeholder="e.g. Model Town, Lahore"
              required={!!geoError}
            />
            {geoError && (
              <span style={{ fontSize: "0.75rem", color: "#92400e", marginTop: "0.25rem" }}>
                {geoErrorMessage(geoError)}
              </span>
            )}
          </label>

          {lat !== null && lng !== null && (
            <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 0.5rem" }}>
              &#10003; Location acquired: {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          )}

          {phase.step === "error" && (
            <div style={{ backgroundColor: "#FBEAEA", border: "2px solid #F5D0D0", borderRadius: 8, padding: "1rem 1.25rem", margin: "0.5rem 0" }}>
              <p style={{ color: "#7A0A1D", margin: 0, fontSize: "0.9rem", fontWeight: 500 }}>{phase.message}</p>
            </div>
          )}

          <button type="submit" disabled={isBusy} style={btnPrimary}>
            {phase.step === "locating" && <LoadingSpinner label="Detecting location\u2026" />}
            {phase.step === "geocoding" && <LoadingSpinner label="Looking up address\u2026" />}
            {phase.step === "submitting" && <LoadingSpinner label="Finding donors\u2026" />}
            {phase.step === "idle" && "Find donors"}
            {phase.step === "error" && "Try Again"}
          </button>
        </form>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <a href="/donate" style={{ color: "#1B7F79", fontSize: "0.85rem", fontWeight: 500 }}>
            Want to donate instead? &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "1.5rem 1rem",
};

const card: React.CSSProperties = {
  padding: "2rem",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
};

const iconWrap: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 16,
  backgroundColor: RED,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 1rem",
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 0.5rem",
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
  backgroundColor: RED,
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
