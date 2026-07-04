/**
 * SupplyCards — Blood supply level cards for the live dashboard.
 *
 * Displays each blood type as a coloured card with a progress bar,
 * status label (Critical/Low/Stable), and available donor count.
 */
"use client";

import type { SupplyStat } from "@/lib/api";

const colorMap: Record<string, string> = {
  critical: "#C8102E",
  low: "#C77E1B",
  ok: "#1B7F79",
};
const bgMap: Record<string, string> = {
  critical: "#FBEAEA",
  low: "#FBF2E2",
  ok: "#E4F1EE",
};
const fgMap: Record<string, string> = {
  critical: "#7A0A1D",
  low: "#7A4E0E",
  ok: "#0F4A47",
};

interface Props {
  stats: SupplyStat[];
}

export default function SupplyCards({ stats }: Props) {
  return (
    <div style={grid}>
      {stats.map((s) => (
        <div key={s.blood_type} style={card}>
          <div style={typeLabel}>{s.blood_type}</div>
          <div style={pctLabel}>{s.pct}% of target reserve</div>
          <div style={barTrack}>
            <div
              style={{
                ...barFill,
                width: `${s.pct}%`,
                backgroundColor: colorMap[s.tag],
              }}
            />
          </div>
          <span
            style={{
              ...tag,
              backgroundColor: bgMap[s.tag],
              color: fgMap[s.tag],
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 32,
};

const card: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  padding: "16px 16px 14px",
};

const typeLabel: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 20,
  fontWeight: 600,
};

const pctLabel: React.CSSProperties = {
  fontSize: 12.5,
  color: "#5C6D66",
  marginTop: 4,
  marginBottom: 10,
};

const barTrack: React.CSSProperties = {
  height: 6,
  borderRadius: 3,
  backgroundColor: "#D8DFDA",
  overflow: "hidden",
};

const barFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 3,
  transition: "width 0.5s ease",
};

const tag: React.CSSProperties = {
  display: "inline-block",
  marginTop: 9,
  fontSize: 11,
  fontWeight: 500,
  padding: "3px 8px",
  borderRadius: 5,
};
