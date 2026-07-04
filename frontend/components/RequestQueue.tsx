/**
 * RequestQueue — Tabular view of active shortage requests with progress bars.
 *
 * Shows each request's blood type, urgency, units needed, accepted donors,
 * and a visual progress bar. Sorted by creation time (newest first).
 */
"use client";

import type { ActiveRequest } from "@/lib/api";

interface Props {
  requests: ActiveRequest[];
}

const urgencyBg: Record<string, string> = {
  critical: "#FBEAEA",
  high: "#FBF2E2",
  routine: "#E4F1EE",
};
const urgencyFg: Record<string, string> = {
  critical: "#7A0A1D",
  high: "#7A4E0E",
  routine: "#0F4A47",
};

const statusLabel: Record<string, string> = {
  open: "Open",
  donors_notified: "Donors notified",
  partially_fulfilled: "Partially fulfilled",
  fulfilled: "Fulfilled",
  closed: "Closed",
};

export default function RequestQueue({ requests }: Props) {
  if (requests.length === 0) {
    return <p style={{ color: "#5C6D66", fontSize: 13, textAlign: "center", padding: "1.5rem 0" }}>No active requests.</p>;
  }

  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={th}>Hospital</th>
          <th style={th}>Type</th>
          <th style={th}>Urgency</th>
          <th style={th}>Units</th>
          <th style={th}>Progress</th>
          <th style={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((r) => {
          const acceptedPct = r.units_needed > 0
            ? Math.min(Math.round((r.accepted_count / r.units_needed) * 100), 100)
            : 0;
          return (
            <tr key={r.request_id}>
              <td style={td}>{r.hospital_name}</td>
              <td style={{ ...td, fontFamily: "'IBM Plex Mono', monospace" }}>
                {r.blood_type}
              </td>
              <td style={td}>
                <span
                  style={{
                    ...badge,
                    backgroundColor: urgencyBg[r.urgency] ?? "#f3f4f6",
                    color: urgencyFg[r.urgency] ?? "#374151",
                    textTransform: "capitalize",
                  }}
                >
                  {r.urgency}
                </span>
              </td>
              <td style={td}>
                {r.accepted_count} / {r.units_needed}
              </td>
              <td style={td}>
                <div style={statusTrack}>
                  <div
                    style={{
                      ...statusFill,
                      width: `${acceptedPct}%`,
                    }}
                  />
                </div>
              </td>
              <td style={{ ...td, color: "#5C6D66", fontSize: 12.5 }}>
                {statusLabel[r.status] ?? r.status}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: React.CSSProperties = {
  textAlign: "left",
  fontWeight: 500,
  fontSize: 11,
  color: "#5C6D66",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "0 10px 8px 0",
  borderBottom: "1px solid #D8DFDA",
};

const td: React.CSSProperties = {
  padding: "11px 10px 11px 0",
  borderBottom: "1px solid #D8DFDA",
  verticalAlign: "middle",
};

const badge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  padding: "3px 9px",
  borderRadius: 5,
  whiteSpace: "nowrap",
};

const statusTrack: React.CSSProperties = {
  width: 90,
  height: 5,
  borderRadius: 3,
  backgroundColor: "#D8DFDA",
  overflow: "hidden",
};

const statusFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 3,
  backgroundColor: "#1B7F79",
  transition: "width 0.4s ease",
};
