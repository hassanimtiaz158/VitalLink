/**
 * RequestDashboard — Match status panel for a specific request.
 *
 * Subscribes to Supabase Realtime for live match updates and displays
 * donor response status (pending/accepted/declined) in a card grid.
 * Includes a verify button for patient requests that hospital staff can
 * use to confirm the request is legitimate before donors are notified.
 */
"use client";

import { useEffect, useState } from "react";
import {
  getRequestMatches,
  verifyRequest,
  updateRequestStatus,
  type RequestWithMatches,
  type MatchDetail,
} from "@/lib/api";
import { subscribeToMatches } from "@/lib/supabase";
import { StatusBadge, ResponseChip, ProgressBar, LiveIndicator } from "@/components/shared";

interface Props {
  requestId: string;
  onBack?: () => void;
}

export default function RequestDashboard({ requestId, onBack }: Props) {
  const [data, setData] = useState<RequestWithMatches | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [fulfillLoading, setFulfillLoading] = useState(false);

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
          return {
            ...prev,
            matches: prev.matches.map((m) =>
              m.match_id === updated.match_id ? { ...m, response: updated.response } : m,
            ),
          };
        }
        return {
          ...prev,
          matches: [...prev.matches, updated],
        };
      });
    });
    return unsub;
  }, [requestId]);

  // Hospital staff can verify patient requests directly
  async function handleVerify() {
    if (!data?.verification_code) return;
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      await verifyRequest(requestId, data.verification_code);
      const updated = await getRequestMatches(requestId);
      setData(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setVerifyError(msg);
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleMarkFulfilled() {
    setFulfillLoading(true);
    try {
      await updateRequestStatus(requestId, "fulfilled");
      const updated = await getRequestMatches(requestId);
      setData(updated);
    } catch { /* retry on next load */ }
    setFulfillLoading(false);
  }

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <StatusBadge status={data.status} />
          {!data.verified_by_hospital && data.requester_type === "patient" && (
            <button
              onClick={handleVerify}
              disabled={verifyLoading}
              style={verifyBtn}
            >
              {verifyLoading ? "Verifying\u2026" : "Verify request"}
            </button>
          )}
        </div>
      </div>

      {verifyError && (
        <p style={{ color: "#dc2626", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>{verifyError}</p>
      )}

      {!data.verified_by_hospital && data.requester_type === "patient" && (
        <div style={verifyNotice}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", lineHeight: 1.4 }}>
            This patient request is unverified. Donors will not be notified until it is verified.
            {!data.verification_code ? "" : ` Code: ${data.verification_code}`}
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div style={summaryRow}>
        <StatCard label="Matched" value={data.matches.length} color="#2563eb" />
        <StatCard label="Accepted" value={accepted} color="#16a34a" />
        <StatCard label="Pending" value={pending} color="#f59e0b" />
        <StatCard label="Declined" value={declined} color="#dc2626" />
      </div>

      {/* Progress bar */}
      <ProgressBar
        percent={Math.min((accepted / data.units_needed) * 100, 100)}
        color={accepted >= data.units_needed ? "#16a34a" : "#f59e0b"}
      />
      <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
        {accepted}/{data.units_needed} accepted
      </p>

      {/* Fulfill action — show when enough donors accepted and not already done */}
      {accepted >= data.units_needed && data.status !== "fulfilled" && data.status !== "closed" && (
        <div style={{ margin: "1rem 0 0" }}>
          <button
            onClick={handleMarkFulfilled}
            disabled={fulfillLoading}
            style={{
              width: "100%",
              padding: "0.65rem",
              border: "none",
              borderRadius: 8,
              backgroundColor: "#16a34a",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: fulfillLoading ? "default" : "pointer",
              opacity: fulfillLoading ? 0.6 : 1,
            }}
          >
            {fulfillLoading ? "Marking\u2026" : "Mark as Fulfilled"}
          </button>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", color: "#6b7280", textAlign: "center" }}>
            {accepted} donor{accepted !== 1 ? "s" : ""} accepted — enough to fulfill this request
          </p>
        </div>
      )}

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
                <td style={tdStyle}>{m.donor_blood_type ?? "\u2014"}</td>
                <td style={tdStyle}>
                  <ResponseChip response={m.response} />
                </td>
                <td style={{ ...tdStyle, fontSize: "0.8rem", color: "#6b7280" }}>
                  {m.notified_at
                    ? new Date(m.notified_at).toLocaleTimeString()
                    : "\u2014"}
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
      <div style={{ marginTop: "1rem" }}>
        <LiveIndicator color="#16a34a" label="Live updates via Supabase Realtime" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (local — only the stat grid for this layout)
// ---------------------------------------------------------------------------
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{label}</div>
    </div>
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

const verifyBtn: React.CSSProperties = {
  padding: "0.35rem 0.75rem",
  border: "none",
  borderRadius: 6,
  backgroundColor: "#16a34a",
  color: "#fff",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
};

const verifyNotice: React.CSSProperties = {
  padding: "0.65rem 0.85rem",
  backgroundColor: "#FEF3C7",
  border: "1px solid #F5D0A0",
  borderRadius: 8,
  marginTop: "0.75rem",
};
