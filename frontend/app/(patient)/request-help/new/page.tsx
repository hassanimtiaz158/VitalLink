/**
 * Patient request form — simple, reassuring, human-first.
 *
 * URL: /request-help/new
 * Captures blood type needed, urgency, units, hospital/clinic address,
 * and a contact method. Registers the patient, then creates the request.
 */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { geocodeAddress } from "@/lib/geocode";
import { registerPatient, createRequest } from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";

const RED = "#C8102E";
const BLOOD_TYPES = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
const URGENCIES = [
  { value: "critical", label: "Critical", desc: "Life-threatening, needed within hours" },
  { value: "high", label: "Urgent", desc: "Needed within 24 hours" },
  { value: "routine", label: "Scheduled", desc: "Planned procedure, within a few days" },
];

type Status =
  | { phase: "idle" }
  | { phase: "geocoding" }
  | { phase: "submitting" }
  | { phase: "error"; message: string };

export default function NewRequestPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bloodType, setBloodType] = useState("O+");
  const [urgency, setUrgency] = useState("critical");
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Geocode the hospital/clinic address
    setStatus({ phase: "geocoding" });
    const location = await geocodeAddress(address);
    if (!location) {
      setStatus({
        phase: "error",
        message: "We could not find that address. Please check the hospital or clinic name and try again.",
      });
      return;
    }

    setStatus({ phase: "submitting" });

    try {
      // 1. Register the patient
      const patient = await registerPatient({
        name,
        email,
        blood_type: bloodType,
        latitude: location.latitude,
        longitude: location.longitude,
      });

      // 2. Create the request
      const request = await createRequest({
        patient_id: patient.patient_id,
        blood_type: bloodType,
        units_needed: unitsNeeded,
        urgency,
      });

      // 3. Redirect to the status page
      router.push(`/request-help/status/${request.request_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setStatus({ phase: "error", message: msg });
    }
  }

  const isBusy = status.phase === "geocoding" || status.phase === "submitting";

  return (
    <div>
      <h2 style={headingStyle}>Request blood</h2>
      <p style={{ color: "#5C6D66", fontSize: "0.9rem", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
        Tell us what is needed and where. We will take it from here.
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        {/* Your name */}
        <label style={labelStyle}>
          Your name
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Your name"
          />
        </label>

        {/* Contact email */}
        <label style={labelStyle}>
          Contact email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="you@example.com"
          />
          <span style={hintStyle}>We will only use this to update you on your request.</span>
        </label>

        {/* Blood type needed */}
        <label style={labelStyle}>
          Blood type needed
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

        {/* Units needed */}
        <label style={labelStyle}>
          Units needed
          <input
            type="number"
            min={1}
            value={unitsNeeded}
            onChange={(e) => setUnitsNeeded(Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        {/* Urgency */}
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 1rem" }}>
          <legend style={labelStyle}>How urgent is this?</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {URGENCIES.map((u) => (
              <label
                key={u.value}
                style={{
                  ...urgencyOption,
                  borderColor: urgency === u.value ? RED : "#D8DFDA",
                  backgroundColor: urgency === u.value ? "#FFF5F5" : "#fff",
                }}
              >
                <input
                  type="radio"
                  name="urgency"
                  value={u.value}
                  checked={urgency === u.value}
                  onChange={(e) => setUrgency(e.target.value)}
                  style={{ accentColor: RED }}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.label}</span>
                  <span style={{ fontSize: "0.8rem", color: "#5C6D66", marginLeft: "0.5rem" }}>{u.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Hospital / Clinic address */}
        <label style={labelStyle}>
          Hospital or clinic address
          <input
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={inputStyle}
            placeholder="e.g. Mount Sinai Hospital, 1 Gustave L. Levy Pl, New York"
          />
          <span style={hintStyle}>
            This is where the donor will go to give blood. Use the hospital name, not a home address.
          </span>
        </label>

        {/* Error */}
        {status.phase === "error" && (
          <div style={errorBox}>
            <p style={{ color: "#7A0A1D", margin: 0, fontSize: "0.85rem" }}>{status.message}</p>
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={isBusy} style={submitBtn}>
          {status.phase === "geocoding" && <LoadingSpinner label="Looking up location\u2026" />}
          {status.phase === "submitting" && <LoadingSpinner label="Submitting\u2026" />}
          {status.phase === "idle" && "Submit request"}
          {status.phase === "error" && "Try again"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#5C6D66", margin: "1rem 0 0" }}>
        Your information is confidential. Donors only see the blood type and hospital name.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const headingStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  margin: "0 0 0.25rem",
};

const formStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #D8DFDA",
  borderRadius: 12,
  padding: "1.5rem",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.2rem",
  marginBottom: "1rem",
  fontSize: "0.85rem",
  fontWeight: 500,
};

const hintStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#5C6D66",
  fontWeight: 400,
};

const inputStyle: React.CSSProperties = {
  padding: "0.55rem 0.75rem",
  border: "1px solid #D1D5DB",
  borderRadius: 6,
  fontSize: "0.95rem",
  marginTop: "0.2rem",
};

const urgencyOption: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.65rem 0.85rem",
  border: "1px solid #D8DFDA",
  borderRadius: 8,
  cursor: "pointer",
  transition: "all 0.15s",
};

const errorBox: React.CSSProperties = {
  backgroundColor: "#FFF5F5",
  border: "1px solid #F5D0D0",
  borderRadius: 8,
  padding: "0.75rem 1rem",
  marginBottom: "1rem",
};

const submitBtn: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  border: "none",
  borderRadius: 8,
  backgroundColor: RED,
  color: "#fff",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  minHeight: 48,
};
