/**
 * Hospital login page — entry point for hospital staff.
 *
 * In a real app this would authenticate. For the MVP demo, it reads the
 * hospital ID from a text input and redirects to the dashboard. The demo
 * pre-fills with NEXT_PUBLIC_DEMO_HOSPITAL_ID.
 *
 * URL: /hospital/login
 */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const SLATE = "#374151";

export default function HospitalLoginPage() {
  const router = useRouter();
  const [hospitalId, setHospitalId] = useState(
    process.env.NEXT_PUBLIC_DEMO_HOSPITAL_ID ?? "",
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hospitalId.trim()) return;
    // Store in sessionStorage so the dashboard can read it
    sessionStorage.setItem("vitallink_hospital_id", hospitalId.trim());
    router.push("/hospital/dashboard");
  }

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={iconCircle}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 28, height: 28 }}>
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
              <path d="M12 7v10M7 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
            Hospital Dashboard
          </h1>
          <p style={{ color: "#5C6D66", fontSize: "0.9rem", margin: 0 }}>
            Sign in to manage blood shortage requests
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Hospital ID
            <input
              type="text"
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
              style={inputStyle}
              placeholder="uuid from POST /hospitals"
              required
            />
          </label>

          <button type="submit" style={submitBtn}>
            Continue to dashboard
          </button>
        </form>

        <p style={{ fontSize: "0.75rem", color: "#9CA3AF", textAlign: "center", margin: "1rem 0 0" }}>
          Register your hospital first via POST /hospitals if you do not have an ID.
        </p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const mainStyle: React.CSSProperties = {
  maxWidth: 420,
  margin: "0 auto",
  padding: "4rem 1rem",
  fontFamily: "system-ui, sans-serif",
};

const cardStyle: React.CSSProperties = {
  padding: "2rem",
  backgroundColor: "#fff",
  border: "1px solid #D8DFDA",
  borderRadius: 12,
};

const iconCircle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 14,
  backgroundColor: SLATE,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 1rem",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.85rem",
  fontWeight: 500,
  marginBottom: "1rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "0.95rem",
  marginTop: "0.25rem",
};

const submitBtn: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem",
  border: "none",
  borderRadius: 8,
  backgroundColor: SLATE,
  color: "#fff",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
};
