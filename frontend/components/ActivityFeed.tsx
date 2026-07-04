/**
 * ActivityFeed — Live event feed of recent shortage requests.
 *
 * Displays requests in reverse-chronological order with urgency badges,
 * blood type, hospital name, and match count. Auto-updates via Supabase
 * Realtime subscriptions.
 */
"use client";

import type { ActiveRequest } from "@/lib/api";

interface Props {
  requests: ActiveRequest[];
}

const colorMap: Record<string, string> = {
  critical: "#C8102E",
  high: "#C77E1B",
  routine: "#1B7F79",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function ActivityFeed({ requests }: Props) {
  // Convert requests into feed-style entries, most recent first
  const feed = requests.slice(0, 10).map((r) => ({
    level: r.urgency,
    text:
      r.status === "fulfilled"
        ? `<b>${r.hospital_name}</b> marked ${r.blood_type} request as fulfilled`
        : r.match_count > 0
          ? `${r.match_count} donors notified for <b>${r.hospital_name}</b> ${r.blood_type} shortage`
          : `<b>${r.hospital_name}</b> posted a ${r.urgency} request for ${r.blood_type} · ${r.units_needed} units`,
    time: timeAgo(r.created_at),
  }));

  if (feed.length === 0) {
    return <p style={{ color: "#5C6D66", fontSize: 13, textAlign: "center", padding: "1.5rem 0" }}>No activity yet.</p>;
  }

  return (
    <div style={list}>
      {feed.map((f, i) => (
        <div key={i} style={item}>
          <div style={{ ...dot, backgroundColor: colorMap[f.level] ?? "#6b7280" }} />
          <div>
            <div
              style={text}
              dangerouslySetInnerHTML={{ __html: f.text }}
            />
            <div style={time}>{f.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const list: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const item: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "10px 0",
  borderBottom: "1px solid #D8DFDA",
};

const dot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  marginTop: 6,
  flexShrink: 0,
};

const text: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
};

const time: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  color: "#5C6D66",
  marginTop: 2,
};
