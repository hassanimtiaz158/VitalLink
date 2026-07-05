/**
 * Donor dashboard — profile, availability, match requests, and impact stats.
 *
 * URL: /donate/dashboard
 * Guarded: redirects to /donate if no donor ID in localStorage.
 * Looks up the donor by ID from localStorage. Shows:
 *   - Profile card (name, blood type, email, location)
 *   - Availability toggle
 *   - Pending match requests with "I can help" / "Not right now"
 *   - Donation history and impact counter
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

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; donor: DonorResponse; matches: DonorMatchesResponse };

export default function DonorDashboardPage() {
  return (
    <RoleGuard storage="localStorage" key="vitallink_donor_id" redirectTo="/donate">
      <DonorDashboardInner />
    </RoleGuard>
  );
}

function DonorDashboardInner() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [donorIdInput, setDonorIdInput] = useState("");
  const [toggling, setToggling] = useState(false);

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

  // Check localStorage on mount
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
    } catch {
      // silently fail — will retry on next load
    }
    setToggling(false);
  }

  async function handleRespond(matchId: string, response: "accepted" | "declined") {
    try {
      await respondToMatch(matchId, response);
      if (state.phase === "ready") {
        const matches = await getDonorMatches(state.donor.donor_id);
        setState({ ...state, matches });
      }
    } catch {
      // silently fail
    }
  }

  // --- Loading ---
  if (state.phase === "loading") {
    return <LoadingSpinner label="Loading your dashboard\u2026" />;
  }

  // --- Error ---
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

  // --- Ready ---
  const { donor, matches } = state;

  return (
    <div>
      {/* Profile card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ ...avatarStyle, backgroundColor: TEAL }}>
            {donor.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{donor.name}</h2>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: "2px 0 0" }}>
              {donor.blood_type} &middot; Registered {new Date(donor.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div style={infoGrid}>
          <InfoRow label="Email" value={donor.email} />
          <InfoRow label="Blood type" value={donor.blood_type} />
          <InfoRow label="Location" value={`${donor.latitude.toFixed(4)}, ${donor.longitude.toFixed(4)}`} />
          <InfoRow
            label="Status"
            value={donor.available ? "Available" : "Unavailable"}
            valueColor={donor.available ? TEAL : "#9CA3AF"}
          />
        </div>
      </div>

      {/* Availability toggle */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Availability</h3>
            <p style={{ color: "#5C6D66", fontSize: "0.8rem", margin: "4px 0 0" }}>
              {donor.available
                ? "You will receive match notifications when hospitals need your blood type."
                : "You are paused. Toggle on to receive notifications again."}
            </p>
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

      {/* Pending matches */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
          Pending requests
          {matches.pending.length > 0 && (
            <span style={{ ...badgeStyle, backgroundColor: RED }}>{matches.pending.length}</span>
          )}
        </h3>
        {matches.pending.length === 0 ? (
          <div style={emptyOnboardStyle}>
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
          matches.pending.map((m) => (
            <MatchCard
              key={m.match_id}
              match={m}
              onRespond={(r) => handleRespond(m.match_id, r)}
            />
          ))
        )}
      </div>

      {/* Impact counter */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Your impact</h3>
        <div style={impactGrid}>
          <ImpactStat label="Notifications" value={matches.impact.total_notified} />
          <ImpactStat label="Accepted" value={matches.impact.accepted} color={TEAL} />
          <ImpactStat label="Lives saved" value={matches.impact.lives_potentially_saved} color={RED} />
        </div>
        {matches.impact.total_notified === 0 && (
          <p style={{ color: "#5C6D66", fontSize: "0.8rem", margin: "0.75rem 0 0", textAlign: "center" }}>
            Your stats will grow as you respond to donation requests.
          </p>
        )}
      </div>

      {/* History */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Donation history</h3>
        {matches.history.length === 0 ? (
          <div style={emptyOnboardStyle}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>&#128203;</div>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
              Your response history will appear here once you accept or decline a request.
            </p>
          </div>
        ) : (
          <div>
            {matches.history.map((m) => (
              <div key={m.match_id} style={historyRow}>
                <span style={{ fontWeight: 600 }}>{m.blood_type}</span>
                <span style={{
                  padding: "0.1rem 0.5rem",
                  borderRadius: 4,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  backgroundColor: m.response === "accepted" ? "#E4F1EE" : "#F3F4F6",
                  color: m.response === "accepted" ? TEAL : "#6B7280",
                  textTransform: "capitalize" as const,
                }}>
                  {m.response}
                </span>
                <span style={{ fontSize: "0.8rem", color: "#5C6D66", marginLeft: "auto" }}>
                  {m.hospital_name ?? "Hospital"} &middot; {m.distance_km ?? "?"} km
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function MatchCard({ match, onRespond }: { match: DonorMatchEntry; onRespond: (r: "accepted" | "declined") => void }) {
  return (
    <div style={matchCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{match.blood_type}</span>
        <UrgencyBadge urgency={match.urgency} />
      </div>
      <p style={{ fontSize: "0.8rem", color: "#5C6D66", margin: "0.5rem 0" }}>
        {match.hospital_name ?? "Hospital"} &middot; {match.distance_km ?? "?"} km away &middot; {match.units_needed} units needed
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={() => onRespond("accepted")} style={acceptBtn}>I can help</button>
        <button onClick={() => onRespond("declined")} style={declineBtn}>Not right now</button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ fontSize: "0.8rem", color: "#5C6D66" }}>{label}</span>
      <span style={{ fontSize: "0.8rem", fontWeight: 500, color: valueColor ?? "#14231F" }}>{value}</span>
    </div>
  );
}

function ImpactStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "0.75rem" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: color ?? "#14231F" }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "#5C6D66" }}>{label}</div>
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

const headingStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  margin: "0 0 1rem",
};

const avatarStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: "1.25rem",
  fontWeight: 700,
  flexShrink: 0,
};

const infoGrid: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.85rem",
  fontWeight: 500,
  marginBottom: "0.75rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "0.9rem",
  marginTop: "0.25rem",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem",
  border: "none",
  borderRadius: 8,
  backgroundColor: TEAL,
  color: "#fff",
  fontSize: "0.9rem",
  fontWeight: 600,
  cursor: "pointer",
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

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 20,
  height: 20,
  borderRadius: 10,
  color: "#fff",
  fontSize: "0.7rem",
  fontWeight: 700,
  marginLeft: "0.5rem",
  padding: "0 6px",
};

const matchCardStyle: React.CSSProperties = {
  padding: "0.85rem",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  marginBottom: "0.5rem",
  backgroundColor: "#FAFBFC",
};

const acceptBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.5rem",
  border: "none",
  borderRadius: 6,
  backgroundColor: TEAL,
  color: "#fff",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
};

const declineBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.5rem",
  border: "1px solid #D1D5DB",
  borderRadius: 6,
  backgroundColor: "#fff",
  color: "#6B7280",
  fontSize: "0.8rem",
  fontWeight: 500,
  cursor: "pointer",
};

const emptyOnboardStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "1.5rem 1rem",
  backgroundColor: "#F0FAF8",
  borderRadius: 8,
  border: "1px dashed #B2DFDB",
};

const impactGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "0.5rem",
  backgroundColor: "#F9FAFB",
  borderRadius: 8,
};

const historyRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.5rem 0",
  borderBottom: "1px solid #F3F4F6",
  fontSize: "0.85rem",
};
