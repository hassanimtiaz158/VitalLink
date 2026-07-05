/**
 * Patient status page — live, reassuring, real-time.
 *
 * URL: /request-help/status/[id]
 * No login required. Shows request status, donors notified, responses,
 * and live updates via Supabase Realtime. Copy is warm and human.
 *
 * Verification: patient requests start unverified. A short code (from
 * hospital staff) must be entered before donors are notified. This
 * prevents false requests from wasting donor time.
 */
"use client";

import { FormEvent, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getRequestMatches,
  verifyRequest,
  type RequestWithMatches,
  type MatchDetail,
} from "@/lib/api";
import { subscribeToMatches } from "@/lib/supabase";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBanner from "@/components/ErrorBanner";
import { StatCard, ResponseChip, LiveIndicator, ProgressBar } from "@/components/shared";

const RED = "#C8102E";
const TEAL = "#1B7F79";
const AMBER = "#C77E1B";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; data: RequestWithMatches };

export default function PatientStatusPage() {
  const params = useParams();
  const requestId = params.id as string;
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getRequestMatches(requestId);
      setState({ phase: "ready", data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load your request";
      setState({ phase: "error", message: msg });
    }
  }, [requestId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Supabase Realtime — live updates
  useEffect(() => {
    const unsub = subscribeToMatches(requestId, (row) => {
      const updated = row as unknown as MatchDetail;
      setState((prev) => {
        if (prev.phase !== "ready") return prev;
        const exists = prev.data.matches.find((m) => m.match_id === updated.match_id);
        if (exists) {
          return {
            ...prev,
            data: {
              ...prev.data,
              matches: prev.data.matches.map((m) =>
                m.match_id === updated.match_id ? { ...m, response: updated.response } : m,
              ),
            },
          };
        }
        return {
          ...prev,
          data: { ...prev.data, matches: [...prev.data.matches, updated] },
        };
      });
    });
    return unsub;
  }, [requestId]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    setVerifyLoading(true);
    try {
      await verifyRequest(requestId, verifyCode);
      setVerifyCode("");
      await fetchData(); // re-fetch to get updated verified status + matches
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setVerifyError(msg);
    } finally {
      setVerifyLoading(false);
    }
  }

  // --- Loading ---
  if (state.phase === "loading") {
    return (
      <div style={cardStyle}>
        <LoadingSpinner label="Finding your request\u2026" />
      </div>
    );
  }

  // --- Error ---
  if (state.phase === "error") {
    return (
      <div>
        <ErrorBanner message={state.message} onRetry={fetchData} />
        <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem", color: "#5C6D66" }}>
          If you just submitted your request, give it a moment and try again.
        </p>
      </div>
    );
  }

  // --- Ready ---
  const { data } = state;
  const isVerified = data.verified_by_hospital;
  const accepted = data.matches.filter((m) => m.response === "accepted").length;
  const pending = data.matches.filter((m) => m.response === "pending").length;
  const notified = data.matches.length;
  const progress = data.units_needed > 0 ? Math.min((accepted / data.units_needed) * 100, 100) : 0;

  const statusLabel = !isVerified
    ? "Awaiting verification"
    : data.status === "fulfilled"
      ? "Fulfilled"
      : data.status === "partially_fulfilled"
        ? "Partially fulfilled"
        : data.status === "donors_notified"
          ? "Donors notified"
          : "Searching for donors";

  return (
    <div>
      {/* Status header */}
      <div style={statusBanner(data.status, isVerified)}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <LiveIndicator color={isVerified ? TEAL : AMBER} label="Live status" />
        </div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
          {data.blood_type} &middot; {data.units_needed} unit{data.units_needed !== 1 ? "s" : ""} needed
        </h2>
        <p style={{ fontSize: "0.9rem", margin: 0, color: "#374151" }}>
          {statusLabel}
        </p>
      </div>

      {/* Verification prompt for unverified patient requests */}
      {!isVerified && data.requester_type === "patient" && (
        <div style={verifyBox}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0 0 0.25rem" }}>
            Your request needs verification
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#5C6D66", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
            To make sure your request is real, please ask the hospital staff for
            a short verification code and enter it below. Once verified, donors
            will be notified right away.
          </p>

          {/* Demo hint — shows the code for judges / demo day */}
          {data.verification_code && (
            <div style={demoHint}>
              <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>Demo code:</span>
              <code style={demoCode}>{data.verification_code}</code>
            </div>
          )}

          <form onSubmit={handleVerify} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="Enter code"
                maxLength={8}
                required
                style={codeInput}
              />
              {verifyError && (
                <p style={{ color: RED, fontSize: "0.8rem", margin: "0.35rem 0 0" }}>{verifyError}</p>
              )}
            </div>
            <button type="submit" disabled={verifyLoading} style={verifyBtn}>
              {verifyLoading ? "Verifying\u2026" : "Verify"}
            </button>
          </form>
          <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: "0.5rem 0 0" }}>
            Donors cannot see this request until it is verified. Your information is safe.
          </p>
        </div>
      )}

      {/* Verified request content */}
      {isVerified && (
        <>
          {/* Progress */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Donors responding</span>
              <span style={{ fontSize: "0.85rem", color: "#5C6D66" }}>
                {accepted} of {data.units_needed} needed
              </span>
            </div>
            <ProgressBar percent={progress} color={accepted >= data.units_needed ? TEAL : AMBER} />
          </div>

          {/* Stats row */}
          <div style={statsRow}>
            <StatCard label="Notified" value={notified} sub="donors" color="#3B82F6" />
            <StatCard label="Accepted" value={accepted} sub="ready to help" color={TEAL} />
            <StatCard label="Pending" value={pending} sub="haven't replied" color={AMBER} />
          </div>

          {/* Reassurance message */}
          {accepted === 0 && notified > 0 && (
            <div style={reassuranceBox}>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "#374151" }}>
                <strong>Donors are being notified right now.</strong> It can take a few minutes
                for them to see the email and respond. We will update this page the moment
                someone says &ldquo;I can help.&rdquo;
              </p>
            </div>
          )}

          {accepted > 0 && accepted < data.units_needed && (
            <div style={{ ...reassuranceBox, backgroundColor: "#F0FAF8", borderColor: "#B2DFDB" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "#374151" }}>
                <strong>{accepted} donor{accepted !== 1 ? "s have" : " has"} accepted.</strong>
                {" "}We are still looking for {data.units_needed - accepted} more.
                Hang in there.
              </p>
            </div>
          )}

          {accepted >= data.units_needed && (
            <div style={{ ...reassuranceBox, backgroundColor: "#F0FAF8", borderColor: "#B2DFDB" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "#374151" }}>
                <strong>Enough donors have accepted.</strong> Your request is fulfilled.
                Please coordinate with the hospital for next steps.
              </p>
            </div>
          )}

          {/* Live donor responses */}
          {data.matches.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
                Donor responses
              </h3>
              {data.matches.map((m) => (
                <div key={m.match_id} style={donorRow(m.response)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ ...donorAvatar, backgroundColor: m.response === "accepted" ? TEAL : m.response === "declined" ? "#9CA3AF" : AMBER }}>
                      {(m.donor_name ?? "D").charAt(0)}
                    </div>
                    <div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                        {m.donor_name ?? "A donor"}
                      </span>
                      {m.distance_km != null && (
                        <span style={{ fontSize: "0.75rem", color: "#5C6D66", marginLeft: "0.5rem" }}>
                          {m.distance_km} km away
                        </span>
                      )}
                    </div>
                  </div>
                  <ResponseChip response={m.response} />
                </div>
              ))}
            </div>
          )}

          {/* What now */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>What now?</h3>
            <p style={{ fontSize: "0.85rem", color: "#5C6D66", margin: 0, lineHeight: 1.5 }}>
              Keep this page open — it updates automatically. You can also share this link
              with family members so they can follow along. If you have questions, contact
              the hospital directly.
            </p>
          </div>
        </>
      )}

      {/* Back link */}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <Link href="/request-help" style={{ color: RED, fontSize: "0.85rem", fontWeight: 500 }}>
          &larr; Back to request help
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const cardStyle: React.CSSProperties = {
  padding: "1.25rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
  marginBottom: "0.75rem",
};

function statusBanner(status: string, isVerified: boolean): React.CSSProperties {
  if (!isVerified) {
    return {
      padding: "1.25rem",
      borderRadius: 10,
      backgroundColor: "#FEF3C7",
      border: "1px solid #F5D0A0",
      marginBottom: "0.75rem",
    };
  }
  const bg = status === "fulfilled" ? "#F0FAF8"
    : status === "partially_fulfilled" ? "#FEF3C7"
    : "#FFF5F5";
  const border = status === "fulfilled" ? "#B2DFDB"
    : status === "partially_fulfilled" ? "#F5D0A0"
    : "#F5D0D0";
  return {
    padding: "1.25rem",
    borderRadius: 10,
    backgroundColor: bg,
    border: `1px solid ${border}`,
    marginBottom: "0.75rem",
  };
}

const verifyBox: React.CSSProperties = {
  padding: "1.25rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
  marginBottom: "0.75rem",
};

const demoHint: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.5rem 0.75rem",
  backgroundColor: "#F9FAFB",
  border: "1px dashed #D1D5DB",
  borderRadius: 6,
  marginBottom: "0.75rem",
};

const demoCode: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.15em",
  color: "#1B7F79",
  backgroundColor: "#E4F1EE",
  padding: "0.15rem 0.5rem",
  borderRadius: 4,
};

const codeInput: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  border: "1px solid #D1D5DB",
  borderRadius: 6,
  fontSize: "1.1rem",
  fontFamily: "monospace",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
};

const verifyBtn: React.CSSProperties = {
  padding: "0.6rem 1.25rem",
  border: "none",
  borderRadius: 6,
  backgroundColor: "#1B7F79",
  color: "#fff",
  fontSize: "0.9rem",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  minHeight: 42,
};

const statsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "0.5rem",
  marginBottom: "0.75rem",
};

const reassuranceBox: React.CSSProperties = {
  backgroundColor: "#FFF5F5",
  border: "1px solid #F5D0D0",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  marginBottom: "0.75rem",
};

function donorRow(_response: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.65rem 0",
    borderBottom: "1px solid #F3F4F6",
  };
}

const donorAvatar: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: "0.8rem",
  fontWeight: 700,
  flexShrink: 0,
};
