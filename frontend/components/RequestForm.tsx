/**
 * RequestForm — Hospital shortage request form.
 *
 * Captures blood type, units needed, and urgency level. On submit,
 * posts to POST /requests which triggers the matching engine.
 */
"use client";

import { FormEvent, useState } from "react";
import { createRequest, type RequestResponse } from "@/lib/api";

const BLOOD_TYPES = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
const URGENCIES = ["critical", "high", "routine"];

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; request: RequestResponse }
  | { state: "error"; message: string };

interface Props {
  hospitalId: string;
  onRequestCreated?: (request: RequestResponse) => void;
}

export default function RequestForm({ hospitalId, onRequestCreated }: Props) {
  const [bloodType, setBloodType] = useState("O-");
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [urgency, setUrgency] = useState("critical");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ state: "submitting" });

    try {
      const request = await createRequest({
        hospital_id: hospitalId,
        blood_type: bloodType,
        units_needed: unitsNeeded,
        urgency,
      });
      setStatus({ state: "success", request });
      onRequestCreated?.(request);
    } catch (err: any) {
      setStatus({ state: "error", message: err.message ?? "Failed" });
    }
  }

  if (status.state === "success") {
    return (
      <div style={cardStyle}>
        <h3 style={headingStyle}>Request Posted</h3>
        <p style={{ margin: "0.25rem 0" }}>
          {status.request.blood_type} x{status.request.units_needed} ({status.request.urgency})
        </p>
        <p style={{ margin: "0.25rem 0", color: "#6b7280" }}>
          Matched <strong>{status.request.matched_donors}</strong> donors
        </p>
        <button
          onClick={() => setStatus({ state: "idle" })}
          style={btnSecondary}
        >
          Post Another
        </button>
      </div>
    );
  }

  const isBusy = status.state === "submitting";

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <h3 style={headingStyle}>New Shortage Request</h3>

      {/* Blood Type */}
      <label style={labelStyle}>
        Blood Type Needed
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

      {/* Units */}
      <label style={labelStyle}>
        Units Needed
        <input
          type="number"
          min={1}
          value={unitsNeeded}
          onChange={(e) => setUnitsNeeded(Number(e.target.value))}
          style={inputStyle}
        />
      </label>

      {/* Urgency */}
      <label style={labelStyle}>
        Urgency
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {URGENCIES.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUrgency(u)}
              style={{
                ...urgencyBtnBase,
                backgroundColor: urgency === u ? urgencyColor(u) : "#f3f4f6",
                color: urgency === u ? "#fff" : "#374151",
                fontWeight: urgency === u ? 700 : 400,
              }}
            >
              {u.charAt(0).toUpperCase() + u.slice(1)}
            </button>
          ))}
        </div>
      </label>

      {/* Error */}
      {status.state === "error" && (
        <p style={{ color: "#dc2626", margin: "0.5rem 0" }}>{status.message}</p>
      )}

      <button type="submit" disabled={isBusy} style={btnPrimary}>
        {isBusy ? "Posting\u2026" : "Post Request"}
      </button>
    </form>
  );
}

function urgencyColor(u: string): string {
  if (u === "critical") return "#dc2626";
  if (u === "high") return "#f59e0b";
  return "#22c55e";
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const cardStyle: React.CSSProperties = {
  padding: "1.5rem",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "1.15rem",
  fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  marginBottom: "0.75rem",
  fontSize: "0.85rem",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "1rem",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem",
  border: "none",
  borderRadius: 8,
  backgroundColor: "#dc2626",
  color: "#fff",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "0.25rem",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  backgroundColor: "#6b7280",
  marginTop: "0.75rem",
};

const urgencyBtnBase: React.CSSProperties = {
  flex: 1,
  padding: "0.5rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "0.85rem",
  transition: "all 0.15s",
};
