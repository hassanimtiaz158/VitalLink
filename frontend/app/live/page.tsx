/**
 * Public live dashboard — real-time overview of all active requests.
 *
 * Displays SupplyCards (blood inventory levels), LiveMap (Leaflet.js
 * map with urgency-coloured markers), ActivityFeed (recent requests),
 * and RequestQueue (tabular view with progress bars). All data refreshes
 * via Supabase Realtime subscriptions.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getActiveRequestsFeed,
  getSupplyStats,
  listDonors,
  type ActiveRequest,
  type SupplyStat,
  type DonorResponse,
} from "@/lib/api";
import { subscribeToNewRequests } from "@/lib/supabase";
import SupplyCards from "@/components/SupplyCards";
import LiveMap from "@/components/LiveMap";
import ActivityFeed from "@/components/ActivityFeed";
import RequestQueue from "@/components/RequestQueue";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBanner from "@/components/ErrorBanner";
import EmptyState from "@/components/EmptyState";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; requests: ActiveRequest[]; stats: SupplyStat[]; donors: DonorResponse[] };

export default function LiveDashboard() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const fetchData = useCallback(async () => {
    try {
      const [reqs, s] = await Promise.all([getActiveRequestsFeed(), getSupplyStats()]);
      // Fetch donors separately — don't block the map if this is slow
      let d: DonorResponse[] = [];
      try {
        d = await listDonors();
      } catch {
        // Donors failed to load — map still works with requests only
      }
      setState({ phase: "ready", requests: reqs, stats: s, donors: d });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard data";
      setState({ phase: "error", message: msg });
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for fresh data every 15s (only if ready)
  useEffect(() => {
    if (state.phase !== "ready") return;
    const interval = setInterval(() => {
      fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, [state.phase, fetchData]);

  // Supabase Realtime — prepend new requests instantly
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

  // --- Loading state ---
  if (state.phase === "loading") {
    return (
      <div style={wrap}>
        <div style={header}>
          <div style={brand}>
            <div style={mark}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
                <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>VitalLink</h1>
              <p style={{ fontSize: 12.5, color: "#5C6D66", margin: "1px 0 0" }}>Loading live dashboard\u2026</p>
            </div>
          </div>
        </div>
        <div style={{ padding: "3rem 0" }}>
          <LoadingSpinner label="Connecting to network\u2026" />
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (state.phase === "error") {
    return (
      <div style={wrap}>
        <div style={header}>
          <div style={brand}>
            <div style={mark}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
                <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>VitalLink</h1>
              <p style={{ fontSize: 12.5, color: "#5C6D66", margin: "1px 0 0" }}>Connection error</p>
            </div>
          </div>
        </div>
        <ErrorBanner message={state.message} onRetry={fetchData} />
      </div>
    );
  }

  // --- Ready state ---
  const { requests, stats, donors } = state;
  const criticalCount = requests.filter((r) => r.urgency === "critical").length;

  return (
    <div style={wrap}>
      {/* Header */}
      <header style={header}>
        <div style={brand}>
          <div style={mark}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
              <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>VitalLink</h1>
            <p style={{ fontSize: 12.5, color: "#5C6D66", margin: "1px 0 0" }}>
              Live donor network &middot; SDG 3 — Good Health &amp; Well-being
            </p>
          </div>
        </div>
        <div style={pulseStrip}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={liveDot} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5C6D66" }}>
              Network active &middot;{" "}
              <strong style={{ color: "#C8102E" }}>{criticalCount} critical</strong> requests
            </span>
          </span>
        </div>
      </header>

      {/* Supply cards */}
      <p style={sectionLabel}>Regional supply levels</p>
      {stats.length > 0 ? (
        <SupplyCards stats={stats} />
      ) : (
        <EmptyState
          title="No supply data yet"
          message="Donor supply levels will appear here once donors register."
        />
      )}

      {/* Map + Feed */}
      <div style={mainGrid}>
        <div style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <h2 style={panelTitle}>Active requests near you</h2>
              <p style={panelSub}>Auto-centers on your location &middot; donor addresses are never shown</p>
            </div>
          </div>
          {requests.length > 0 || donors.length > 0 ? (
            <LiveMap requests={requests} donors={donors} />
          ) : (
            <EmptyState
              icon="&#128205;"
              title="No active requests"
              message="Hospital shortage requests will appear on the map as they are posted."
            />
          )}
        </div>
        <div style={panel}>
          <h2 style={panelTitle}>Live activity feed</h2>
          <p style={panelSub}>Matching + notification events, most recent first</p>
          <ActivityFeed requests={requests} />
        </div>
      </div>

      {/* Request queue */}
      <div style={panel}>
        <h2 style={panelTitle}>Request queue</h2>
        <p style={panelSub}>Fulfillment progress across all open requests</p>
        <RequestQueue requests={requests} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const wrap: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "32px 28px 64px",
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: 20,
  borderBottom: "1px solid #D8DFDA",
  marginBottom: 28,
  flexWrap: "wrap",
  gap: 16,
};

const brand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const mark: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#C8102E",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const pulseStrip: React.CSSProperties = {
  flex: 1,
  minWidth: 220,
  maxWidth: 420,
  height: 44,
  backgroundColor: "#fff",
  border: "1px solid #D8DFDA",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  padding: "0 14px",
};

const liveDot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  backgroundColor: "#1B7F79",
  flexShrink: 0,
  animation: "blink 1.6s infinite",
};

const sectionLabel: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#5C6D66",
  margin: "0 0 12px",
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr",
  gap: 20,
  marginBottom: 28,
  alignItems: "start",
};

const panel: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  padding: "18px 20px 20px",
};

const panelTitle: React.CSSProperties = {
  fontSize: 14.5,
  fontWeight: 600,
  margin: "0 0 3px",
};

const panelSub: React.CSSProperties = {
  fontSize: 12,
  color: "#5C6D66",
  margin: "0 0 14px",
};
