"use client";

import { useState } from "react";
import RequestForm from "@/components/RequestForm";
import RequestDashboard from "@/components/RequestDashboard";
import EmptyState from "@/components/EmptyState";
import { type RequestResponse } from "@/lib/api";

const DEMO_HOSPITAL_ID = process.env.NEXT_PUBLIC_DEMO_HOSPITAL_ID ?? "";

export default function DashboardPage() {
  const [hospitalId, setHospitalId] = useState(DEMO_HOSPITAL_ID);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [recentRequests, setRecentRequests] = useState<RequestResponse[]>([]);

  function handleCreated(req: RequestResponse) {
    setRecentRequests((prev) => [req, ...prev]);
    setSelectedRequest(req.request_id);
  }

  if (selectedRequest) {
    return (
      <main style={mainStyle}>
        <RequestDashboard
          requestId={selectedRequest}
          onBack={() => setSelectedRequest(null)}
        />
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <h1 style={pageTitle}>Hospital Dashboard</h1>

      {/* Hospital ID input */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          Hospital ID
          <input
            type="text"
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            style={inputStyle}
            placeholder="uuid from POST /hospitals"
          />
        </label>
        {!hospitalId && (
          <p style={{ fontSize: "0.8rem", color: "#92400e", margin: "0.5rem 0 0", backgroundColor: "#fef3c7", padding: "0.5rem 0.75rem", borderRadius: 6 }}>
            Enter a hospital ID to post shortage requests. Register one first via POST /hospitals.
          </p>
        )}
      </div>

      {/* Request form — only when hospital ID is set */}
      {hospitalId ? (
        <div style={sectionStyle}>
          <RequestForm hospitalId={hospitalId} onRequestCreated={handleCreated} />
        </div>
      ) : (
        <div style={sectionStyle}>
          <EmptyState
            icon="&#127973;"
            title="No hospital selected"
            message="Enter your hospital ID above to start posting shortage requests and matching donors."
          />
        </div>
      )}

      {/* Recent requests list */}
      {recentRequests.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={sectionHeading}>Recent Requests</h3>
          {recentRequests.map((r) => (
            <button
              key={r.request_id}
              onClick={() => setSelectedRequest(r.request_id)}
              style={requestRow}
            >
              <span style={{ fontWeight: 600 }}>{r.blood_type}</span>
              <span style={{ color: "#6b7280" }}>x{r.units_needed}</span>
              <span
                style={{
                  padding: "0.1rem 0.5rem",
                  borderRadius: 4,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor:
                    r.urgency === "critical"
                      ? "#fecaca"
                      : r.urgency === "high"
                        ? "#fef3c7"
                        : "#bbf7d0",
                  textTransform: "capitalize",
                }}
              >
                {r.urgency}
              </span>
              <span style={{ color: "#6b7280", fontSize: "0.8rem", marginLeft: "auto" }}>
                {r.matched_donors} matched
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Empty state for no requests yet */}
      {recentRequests.length === 0 && hospitalId && (
        <div style={sectionStyle}>
          <EmptyState
            icon="&#128203;"
            title="No requests posted yet"
            message="Your shortage requests will appear here after you submit one above."
          />
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const mainStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "2rem 1rem",
  fontFamily: "system-ui, sans-serif",
};

const pageTitle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  margin: "0 0 1.5rem",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "1.5rem",
};

const sectionHeading: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  margin: "0 0 0.75rem",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.85rem",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "0.9rem",
  marginTop: "0.25rem",
};

const requestRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  width: "100%",
  padding: "0.75rem 1rem",
  marginBottom: "0.5rem",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  backgroundColor: "#fff",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "0.9rem",
};
