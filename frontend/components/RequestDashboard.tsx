/**
 * RequestDashboard — Match status panel for a specific request.
 *
 * Subscribes to Supabase Realtime for live match updates and displays
 * donor response status (pending/accepted/declined) in a card grid.
 */
"use client";

import { useEffect, useState } from "react";
import {
  getRequestMatches,
  type RequestWithMatches,
  type MatchDetail,
} from "@/lib/api";
import { subscribeToMatches } from "@/lib/supabase";

interface Props {
  requestId: string;
  onBack?: () => void;
}

export default function RequestDashboard({ requestId, onBack }: Props) {
  const [data, setData] = useState<RequestWithMatches | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    let active = true;
    getRequestMatches(requestId)
      .then((res) => { if (active) setData(res); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [requestId]);

  // Supabase Realtime subscription — live-update matches in-place
  useEffect(() => {
    const unsub = subscribeToMatches(requestId, (row) => {
      setData((prev) => {
        if (!prev) return prev;
        const updated = row as unknown as MatchDetail;
        const exists = prev.matches.find((m) => m.match_id === updated.match_id);
        if (exists) {
          // Update existing match response
          return {
            ...prev,
            matches: prev.matches.map((m) =>
              m.match_id === updated.match_id ? { ...m, response: updated.response } : m,
            ),
          };
        }
        // New match inserted
        return {
          ...prev,
          matches: [...prev.matches, updated],
        };
      });
    });
    return unsub;
  }, [requestId]);

  if (error) return <div style={cardStyle}><p style={{ color: "#dc2626" }}>{error}</p></div>;
  if (!data) return <div style={cardStyle}><p>Loading\u2026</p></div>;

  const accepted = data.matches.filter((m) => m.response === "accepted").length;
  const pending = data.matches.filter((m) => m.response === "pending").length;
  const declined = data.matches.filter((m) => m.response === "declined").length;

  return (
    <div style={cardStyle}>
      {onBack && (
        <button onClick={onBack} style={backBtn}>&larr; Back</button>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
            {data.blood_type} Request
          </h3>
          <p style={{ margin: "0.25rem 0", color: "#6b7280", fontSize: "0.85rem" }}>
            {data.units_needed} units needed &middot; {data.urgency}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {/* Summary cards */}
      <div style={summaryRow}>
        <StatCard label="Matched" value={data.matches.length} color="#2563eb" />
        <StatCard label="Accepted" value={accepted} color="#16a34a" />
        <StatCard label="Pending" value={pending} color="#f59e0b" />
        <StatCard label="Declined" value={declined} color="#dc2626" />
      </div>

      {/* Progress bar */}
      <div style={progressTrack}>
        <div
          style={{
            ...progressFill,
            width: `${Math.min((accepted / data.units_needed) * 100, 100)}%`,
            backgroundColor: accepted >= data.units_needed ? "#16a34a" : "#f59e0b",
          }}
        />
      </div>
      <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
        {accepted}/{data.units_needed} accepted
      </p>

      {/* Donor list */}
      {data.matches.length > 0 && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Donor</th>
              <th style={thStyle}>Blood Type</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Notified</th>
            </tr>
          </thead>
          <tbody>
            {data.matches.map((m) => (
              <tr key={m.match_id} style={trStyle}>
                <td style={tdStyle}>{m.donor_name ?? m.donor_id.slice(0, 8)}</td>
                <td style={tdStyle}>{m.donor_blood_type ?? "—"}</td>
                <td style={tdStyle}>
                  <ResponseChip response={m.response} />
                </td>
                <td style={{ ...tdStyle, fontSize: "0.8rem", color: "#6b7280" }}>
                  {m.notified_at
                    ? new Date(m.notified_at).toLocaleTimeString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.matches.length === 0 && (
        <p style={{ color: "#6b7280", textAlign: "center", padding: "1.5rem 0" }}>
          No donors matched yet.
        </p>
      )}

      {/* Live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "1rem" }}>
        <span style={liveDot} />
        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Live updates via Supabase Realtime</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "#dbeafe",
    donors_notified: "#fef3c7",
    partially_fulfilled: "#fed7aa",
    fulfilled: "#bbf7d0",
    closed: "#e5e7eb",
  };
  return (
    <span
      style={{
        padding: "0.25rem 0.75rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: colors[status] ?? "#f3f4f6",
        textTransform: "capitalize",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{label}</div>
    </div>
  );
}

function ResponseChip({ response }: { response: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "#fef3c7", fg: "#92400e" },
    accepted: { bg: "#bbf7d0", fg: "#166534" },
    declined: { bg: "#fecaca", fg: "#991b1b" },
  };
  const c = colors[response] ?? { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span
      style={{
        padding: "0.15rem 0.5rem",
        borderRadius: 6,
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.fg,
        textTransform: "capitalize",
      }}
    >
      {response}
    </span>
  );
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

const backBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#2563eb",
  cursor: "pointer",
  fontSize: "0.85rem",
  padding: 0,
  marginBottom: "0.75rem",
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  margin: "1rem 0",
  padding: "0.75rem",
  borderRadius: 8,
  backgroundColor: "#f9fafb",
};

const progressTrack: React.CSSProperties = {
  height: 8,
  borderRadius: 4,
  backgroundColor: "#e5e7eb",
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 4,
  transition: "width 0.4s ease",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "1rem",
  fontSize: "0.85rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  borderBottom: "2px solid #e5e7eb",
  fontWeight: 600,
  color: "#6b7280",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid #f3f4f6",
};

const trStyle: React.CSSProperties = {};

const liveDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  backgroundColor: "#16a34a",
  animation: "pulse 1.5s infinite",
};
