"use client";

import { useEffect, useState } from "react";
import {
  getActiveRequestsFeed,
  getSupplyStats,
  type ActiveRequest,
  type SupplyStat,
} from "@/lib/api";
import { subscribeToNewRequests } from "@/lib/supabase";
import SupplyCards from "@/components/SupplyCards";
import LiveMap from "@/components/LiveMap";
import ActivityFeed from "@/components/ActivityFeed";
import RequestQueue from "@/components/RequestQueue";

export default function LiveDashboard() {
  const [requests, setRequests] = useState<ActiveRequest[]>([]);
  const [stats, setStats] = useState<SupplyStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    let active = true;
    Promise.all([getActiveRequestsFeed(), getSupplyStats()])
      .then(([reqs, s]) => {
        if (active) {
          setRequests(reqs);
          setStats(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Poll for fresh data every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([getActiveRequestsFeed(), getSupplyStats()])
        .then(([reqs, s]) => {
          setRequests(reqs);
          setStats(s);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime — prepend new requests instantly
  useEffect(() => {
    const unsub = subscribeToNewRequests((row) => {
      const newReq = row as unknown as ActiveRequest;
      setRequests((prev) => [newReq, ...prev]);
    });
    return unsub;
  }, []);

  const criticalCount = requests.filter((r) => r.urgency === "critical").length;

  if (loading) {
    return (
      <div style={wrap}>
        <p style={{ color: "#5C6D66" }}>Loading live dashboard\u2026</p>
      </div>
    );
  }

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
      <SupplyCards stats={stats} />

      {/* Map + Feed */}
      <div style={mainGrid}>
        <div style={panel}>
          <h2 style={panelTitle}>Active requests — map view</h2>
          <p style={panelSub}>Approximate hospital locations &middot; donor addresses are never shown publicly</p>
          <LiveMap requests={requests} />
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
// Styles — matching demo_dashboard.html CSS variables
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
  gridTemplateColumns: "1.4fr 1fr",
  gap: 20,
  marginBottom: 28,
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
