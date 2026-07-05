/**
 * Hospital dashboard page — overview and request tracking.
 *
 * Shows supply cards (critical blood types), a link to create new requests,
 * and a list of recent requests. Selecting a request opens the live match
 * dashboard (RequestDashboard component with Supabase Realtime).
 *
 * The request form has been extracted to /hospital/requests/new.
 * Guarded: redirects to /hospital/login if no hospital ID in sessionStorage.
 *
 * URL: /hospital/dashboard
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getActiveRequestsFeed, type ActiveRequest } from "@/lib/api";
import { subscribeToNewRequests } from "@/lib/supabase";
import RequestDashboard from "@/components/RequestDashboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBanner from "@/components/ErrorBanner";
import { StatusBadge, UrgencyBadge, RoleGuard } from "@/components/shared";

const DEMO_HOSPITAL_ID = process.env.NEXT_PUBLIC_DEMO_HOSPITAL_ID ?? "";

export default function DashboardPage() {
  return (
    <RoleGuard
      storage="sessionStorage"
      key="vitallink_hospital_id"
      redirectTo="/hospital/login"
      envFallback={DEMO_HOSPITAL_ID}
    >
      <DashboardInner />
    </RoleGuard>
  );
}

function DashboardInner() {
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [activeRequests, setActiveRequests] = useState<ActiveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActiveRequestsFeed()
      .then(setActiveRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Live-update: refetch when a new request appears via Supabase Realtime
  useEffect(() => {
    const unsub = subscribeToNewRequests(() => {
      getActiveRequestsFeed()
        .then(setActiveRequests)
        .catch(() => {});
    });
    return unsub;
  }, []);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={pageTitle}>Dashboard</h1>
        <Link href="/hospital/requests/new" style={newRequestBtn}>
          + New request
        </Link>
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} onRetry={() => window.location.reload()} />}

      {/* Loading */}
      {loading && (
        <div style={cardStyle}>
          <LoadingSpinner label="Loading active requests\u2026" />
        </div>
      )}

      {/* Active requests list */}
      {!loading && activeRequests.length > 0 && (
        <div>
          <h3 style={sectionHeading}>Active Requests ({activeRequests.length})</h3>
          {activeRequests.map((r) => (
            <button
              key={r.request_id}
              onClick={() => setSelectedRequest(r.request_id)}
              style={requestRow}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>{r.blood_type}</span>
                <span style={{ color: "#6b7280" }}>x{r.units_needed}</span>
                <UrgencyBadge urgency={r.urgency} />
                <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                  {r.source_name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  {r.match_count} matched &middot; {r.accepted_count} accepted
                </span>
                <StatusBadge status={r.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && activeRequests.length === 0 && (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <p style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>&#128203;</p>
            <p style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>No active requests</p>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "0 0 1rem" }}>
              Create a shortage request to start matching donors.
            </p>
            <Link href="/hospital/requests/new" style={newRequestBtn}>
              + New request
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const mainStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "2rem 1rem",
  fontFamily: "system-ui, sans-serif",
};

const pageTitle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  margin: 0,
};

const sectionHeading: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  margin: "0 0 0.75rem",
  color: "#5C6D66",
};

const cardStyle: React.CSSProperties = {
  padding: "1.5rem",
  borderRadius: 12,
  border: "1px solid #D8DFDA",
  backgroundColor: "#fff",
  marginBottom: "0.75rem",
};

const newRequestBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "0.5rem 1rem",
  backgroundColor: "#374151",
  color: "#fff",
  borderRadius: 8,
  fontSize: "0.85rem",
  fontWeight: 600,
  textDecoration: "none",
};

const requestRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "0.85rem 1rem",
  marginBottom: "0.5rem",
  border: "1px solid #D8DFDA",
  borderRadius: 8,
  backgroundColor: "#fff",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "0.9rem",
  transition: "box-shadow 0.15s",
};
