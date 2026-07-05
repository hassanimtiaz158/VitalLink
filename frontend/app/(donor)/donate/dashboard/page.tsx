/**
 * Donor dashboard — profile, availability, match requests, and impact stats.
 *
 * URL: /donate/dashboard
 * Guarded: redirects to /donate if no donor ID in localStorage.
 * Shows:
 *   - Welcome header with avatar
 *   - Stats row (notified, accepted, lives saved)
 *   - Availability toggle
 *   - Pending match requests with "I can help" / "Not right now"
 *   - Donation history
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getDonor,
  updateDonorAvailability,
  getDonorMatches,
  respondToMatch,
  type DonorResponse,
  type DonorMatchesResponse,
  type DonorMatchEntry,
} from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBanner from "@/components/ErrorBanner";
import { UrgencyBadge, RoleGuard } from "@/components/shared";

const TEAL = "#1B7F79";
const RED = "#C8102E";
const AMBER = "#C77E1B";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; donor: DonorResponse; matches: DonorMatchesResponse };

export default function DonorDashboardPage() {
  return (
    <RoleGuard storage="localStorage" key="vitallink_donor_id" redirectTo="/donate/register">
      <DonorDashboardInner />
    </RoleGuard>
  );
}

function DonorDashboardInner() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [donorIdInput, setDonorIdInput] = useState("");
  const [toggling, setToggling] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setState({ phase: "loading" });
    try {
      const [donor, matches] = await Promise.all([getDonor(id), getDonorMatches(id)]);
      setState({ phase: "ready", donor, matches });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setState({ phase: "error", message: msg });
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("vitallink_donor_id");
    if (stored) {
      setDonorIdInput(stored);
      load(stored);
    }
  }, [load]);

  function handleLookup() {
    const id = donorIdInput.trim();
    if (!id) return;
    localStorage.setItem("vitallink_donor_id", id);
    load(id);
  }

  async function handleToggleAvailable() {
    if (state.phase !== "ready") return;
    setToggling(true);
    try {
      const updated = await updateDonorAvailability(state.donor.donor_id, !state.donor.available);
      setState({ ...state, donor: updated });
    } catch { /* retry on next load */ }
    setToggling(false);
  }

  async function handleRespond(matchId: string, response: "accepted" | "declined") {
    setRespondingId(matchId);
    try {
      await respondToMatch(matchId, response);
      if (state.phase === "ready") {
        const matches = await getDonorMatches(state.donor.donor_id);
        setState({ ...state, matches });
      }
    } catch { /* silently fail */ }
    setRespondingId(null);
  }

  if (state.phase === "loading") {
    return <LoadingSpinner label="Loading your dashboard\u2026" />;
  }

  if (state.phase === "error") {
    return (
      <div>
        <ErrorBanner message={state.message} onRetry={() => load(donorIdInput)} />
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href="/donate/register" style={{ color: TEAL, fontSize: "0.85rem", fontWeight: 500 }}>
            Register as a new donor
          </Link>
        </div>
      </div>
    );
  }

  const { donor, matches } = state;
  const pending = matches.pending;
  const history = matches.history;
  const impact = matches.impact;

  return (
    <div>
      {/* Welcome header */}
      <div style={welcomeCard}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ ...avatar, backgroundColor: TEAL }}>
            {donor.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>
              Welcome, {donor.name.split(" ")[0]}
            </h1>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: "2px 0 0" }}>
              {donor.blood_type} donor &middot; Registered {new Date(donor.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        {donor.available && pending.length > 0 && (
          <div style={{ ...alertPulse, backgroundColor: "#FFF5F5", borderColor: "#F5D0D0" }}>
            <span style={{ fontSize: "0.85rem", color: "#7A0A1D" }}>
              <strong>{pending.length} request{pending.length !== 1 ? "s" : ""}</strong> need your help right now
            </span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={statsRow}>
        <StatBox
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" fill="#3B82F6"/></svg>}
          label="Notified"
          value={impact.total_notified}
          color="#3B82F6"
        />
        <StatBox
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill={TEAL}/></svg>}
          label="Accepted"
          value={impact.accepted}
          color={TEAL}
        />
        <StatBox
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill={RED}/></svg>}
          label="Lives saved"
          value={impact.lives_potentially_saved}
          color={RED}
        />
      </div>

      {/* Availability */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: donor.available ? "#E4F1EE" : "#F3F4F6",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z"
                  fill={donor.available ? TEAL : "#9CA3AF"}/>
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>
                {donor.available ? "Available to donate" : "Paused"}
              </h3>
              <p style={{ color: "#5C6D66", fontSize: "0.8rem", margin: "2px 0 0" }}>
                {donor.available
                  ? "You will receive notifications when hospitals need your blood type."
                  : "Toggle on to start receiving notifications again."}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleAvailable}
            disabled={toggling}
            style={{
              ...toggleBtn,
              backgroundColor: donor.available ? TEAL : "#D1D5DB",
            }}
          >
            <div style={{
              ...toggleKnob,
              transform: donor.available ? "translateX(20px)" : "translateX(2px)",
            }} />
          </button>
        </div>
      </div>

      {/* Pending requests */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Pending requests</h3>
          {pending.length > 0 && (
            <span style={{ ...countBadge, backgroundColor: RED }}>{pending.length}</span>
          )}
        </div>
        {pending.length === 0 ? (
          <div style={emptyCard}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>&#128153;</div>
            <p style={{ fontWeight: 600, margin: "0 0 0.25rem", fontSize: "0.95rem" }}>
              You&apos;re on the list
            </p>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
              No hospitals near you need {donor.blood_type} right now, but that can change fast.
              We will notify you the moment you&apos;re needed.
            </p>
          </div>
        ) : (
          pending.map((m) => (
            <MatchCard
              key={m.match_id}
              match={m}
              responding={respondingId === m.match_id}
              onRespond={(r) => handleRespond(m.match_id, r)}
            />
          ))
        )}
      </div>

      {/* History */}
      <div style={card}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Donation history</h3>
        {history.length === 0 ? (
          <div style={emptyCard}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>&#128203;</div>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
              Your response history will appear here once you accept or decline a request.
            </p>
          </div>
        ) : (
          history.map((m) => (
            <div key={m.match_id} style={historyRow}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                backgroundColor: m.response === "accepted" ? "#E4F1EE" : "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {m.response === "accepted" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill={TEAL}/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="#9CA3AF"/></svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{m.blood_type}</span>
                  <span style={{
                    padding: "1px 6px", borderRadius: 4, fontSize: "0.65rem", fontWeight: 600,
                    backgroundColor: m.response === "accepted" ? "#E4F1EE" : "#F3F4F6",
                    color: m.response === "accepted" ? TEAL : "#6B7280",
                    textTransform: "uppercase" as const,
                  }}>
                    {m.response}
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#5C6D66", margin: "2px 0 0" }}>
                  {m.hospital_name ?? "Hospital"} &middot; {m.distance_km ?? "?"} km
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <Link href="/donate" style={secondaryLink}>
          &larr; Back to Donate
        </Link>
        <Link href="/live" style={secondaryLink}>
          View live dashboard
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function MatchCard({ match, responding, onRespond }: {
  match: DonorMatchEntry;
  responding: boolean;
  onRespond: (r: "accepted" | "declined") => void;
}) {
  const urgencyBg: Record<string, string> = {
    critical: "#FEF2F2",
    high: "#FFFBEB",
    routine: "#F0FAF8",
  };

  return (
    <div style={{ ...matchCard, backgroundColor: urgencyBg[match.urgency] ?? "#FAFBFC" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{match.blood_type}</span>
          <UrgencyBadge urgency={match.urgency} />
        </div>
        <span style={{ fontSize: "0.75rem", color: "#5C6D66" }}>
          {match.units_needed} unit{match.units_needed !== 1 ? "s" : ""}
        </span>
      </div>
      <p style={{ fontSize: "0.8rem", color: "#5C6D66", margin: "0 0 0.75rem" }}>
        <strong>{match.hospital_name ?? "Hospital"}</strong> &middot; {match.distance_km ?? "?"} km away
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => onRespond("accepted")}
          disabled={responding}
          style={{ ...acceptBtn, opacity: responding ? 0.6 : 1 }}
        >
          {responding ? "Sending\u2026" : "I can help"}
        </button>
        <button
          onClick={() => onRespond("declined")}
          disabled={responding}
          style={{ ...declineBtn, opacity: responding ? 0.6 : 1 }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={statBox}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
        {icon}
        <span style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{value}</span>
      </div>
      <span style={{ fontSize: "0.7rem", color: "#5C6D66", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const welcomeCard: React.CSSProperties = {
  padding: "1.25rem 1.5rem",
  border: "1px solid #D8DFDA",
  borderRadius: 12,
  backgroundColor: "#fff",
  marginBottom: "0.75rem",
};

const card: React.CSSProperties = {
  padding: "1.25rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
  marginBottom: "0.75rem",
};

const avatar: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: "1.25rem",
  fontWeight: 700,
  flexShrink: 0,
};

const alertPulse: React.CSSProperties = {
  marginTop: "0.75rem",
  padding: "0.5rem 0.85rem",
  borderRadius: 8,
  border: "1px solid",
  animation: "pulse-bg 2s ease-in-out infinite",
};

const statsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "0.5rem",
  marginBottom: "0.75rem",
};

const statBox: React.CSSProperties = {
  padding: "1rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
  textAlign: "center",
};

const toggleBtn: React.CSSProperties = {
  width: 44,
  height: 24,
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  position: "relative",
  flexShrink: 0,
  transition: "background-color 0.2s",
};

const toggleKnob: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  backgroundColor: "#fff",
  position: "absolute",
  top: 2,
  transition: "transform 0.2s",
  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
};

const countBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 20,
  height: 20,
  borderRadius: 10,
  color: "#fff",
  fontSize: "0.7rem",
  fontWeight: 700,
  padding: "0 6px",
};

const matchCard: React.CSSProperties = {
  padding: "1rem",
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  marginBottom: "0.5rem",
};

const acceptBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.6rem",
  border: "none",
  borderRadius: 8,
  backgroundColor: TEAL,
  color: "#fff",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.15s",
};

const declineBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.6rem",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  backgroundColor: "#fff",
  color: "#6B7280",
  fontSize: "0.85rem",
  fontWeight: 500,
  cursor: "pointer",
  transition: "opacity 0.15s",
};

const emptyCard: React.CSSProperties = {
  textAlign: "center",
  padding: "1.5rem 1rem",
  backgroundColor: "#F0FAF8",
  borderRadius: 8,
  border: "1px dashed #B2DFDB",
};

const historyRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.6rem 0",
  borderBottom: "1px solid #F3F4F6",
};

const secondaryLink: React.CSSProperties = {
  flex: 1,
  textAlign: "center",
  padding: "0.6rem",
  border: "1px solid #D8DFDA",
  borderRadius: 8,
  backgroundColor: "#fff",
  color: "#374151",
  fontSize: "0.85rem",
  fontWeight: 500,
  textDecoration: "none",
};
