/**
 * Patient request-help page — urgent red accent route.
 *
 * URL: /request-help
 * Provides information about how to request blood and shows nearby
 * active requests. For the MVP this is a simplified view of the
 * live dashboard filtered to the patient's perspective.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getActiveRequestsFeed,
  type ActiveRequest,
} from "@/lib/api";
import { subscribeToNewRequests } from "@/lib/supabase";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBanner from "@/components/ErrorBanner";
import EmptyState from "@/components/EmptyState";

const RED = "#C8102E";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; requests: ActiveRequest[] };

export default function RequestHelpPage() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const fetchData = useCallback(async () => {
    try {
      const reqs = await getActiveRequestsFeed();
      setState({ phase: "ready", requests: reqs });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load requests";
      setState({ phase: "error", message: msg });
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (state.phase !== "ready") return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [state.phase, fetchData]);

  useEffect(() => {
    const unsub = subscribeToNewRequests((row) => {
      const newReq = row as unknown as ActiveRequest;
      setState((prev) => {
        if (prev.phase !== "ready") return prev;
        return { ...prev, requests: [newReq, ...prev.requests] };
      });
    });
    return unsub;
  }, []);

  return (
    <div>
      {/* Hero */}
      <div style={heroStyle}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
          Blood is needed now
        </h2>
        <p style={{ color: "#5C6D66", margin: "0 0 1.5rem", maxWidth: 480 }}>
          Hospitals in your area are actively seeking donors. Below you can see all open shortage
          requests updated in real time.
        </p>
        <Link href="/donate" style={ctaStyle}>Register as a donor</Link>
      </div>

      {/* States */}
      {state.phase === "loading" && <LoadingSpinner label="Loading requests\u2026" />}
      {state.phase === "error" && <ErrorBanner message={state.message} onRetry={fetchData} />}

      {state.phase === "ready" && state.requests.length === 0 && (
        <EmptyState
          icon="&#9989;"
          title="No active requests"
          message="There are currently no open blood shortage requests. Check back soon."
        />
      )}

      {state.phase === "ready" && state.requests.length > 0 && (
        <div>
          <p style={countLabel}>
            {state.requests.length} active request{state.requests.length !== 1 ? "s" : ""}
          </p>
          {state.requests.map((r) => (
            <div key={r.request_id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{r.blood_type}</span>
                <span style={{ color: "#6b7280" }}>x{r.units_needed}</span>
                <span style={{
                  padding: "0.15rem 0.6rem",
                  borderRadius: 4,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor: r.urgency === "critical" ? "#FBEAEA" : r.urgency === "high" ? "#FBF2E2" : "#E4F1EE",
                  color: r.urgency === "critical" ? RED : r.urgency === "high" ? "#C77E1B" : "#1B7F79",
                  textTransform: "capitalize" as const,
                }}>
                  {r.urgency}
                </span>
                <span style={{ fontSize: "0.8rem", color: "#5C6D66", marginLeft: "auto" }}>
                  {r.source_name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const heroStyle: React.CSSProperties = {
  padding: "2rem 0 1.5rem",
  borderBottom: "1px solid #D8DFDA",
  marginBottom: "1.5rem",
};

const ctaStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.65rem 1.5rem",
  backgroundColor: RED,
  color: "#fff",
  textDecoration: "none",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.9rem",
};

const countLabel: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#5C6D66",
  margin: "0 0 0.75rem",
};

const cardStyle: React.CSSProperties = {
  padding: "0.85rem 1.1rem",
  border: "1px solid #D8DFDA",
  borderRadius: 8,
  backgroundColor: "#fff",
  marginBottom: "0.5rem",
};
