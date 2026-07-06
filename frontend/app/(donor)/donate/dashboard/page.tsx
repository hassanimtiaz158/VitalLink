"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { subscribeToDonorMatches } from "@/lib/supabase";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBanner from "@/components/ErrorBanner";
import ChatModal from "@/components/ChatModal";
import { UrgencyBadge } from "@/components/shared";

const TEAL = "#1B7F79";
const RED = "#C8102E";

type Phase =
  | { step: "checking" }
  | { step: "no-id" }
  | { step: "loading" }
  | { step: "error"; message: string }
  | { step: "ready"; donor: DonorResponse; matches: DonorMatchesResponse };

export default function DonorDashboardPage() {
  const [phase, setPhase] = useState<Phase>({ step: "checking" });
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [newMatchAlert, setNewMatchAlert] = useState(false);
  const [chatMatchId, setChatMatchId] = useState<string | null>(null);
  const subRef = useRef<(() => void) | null>(null);
  const seenMessages = useRef<Map<string, number>>(new Map());

  const load = useCallback(async (id: string) => {
    setPhase({ step: "loading" });
    try {
      const [donor, matches] = await Promise.all([getDonor(id), getDonorMatches(id)]);
      setPhase({ step: "ready", donor, matches });
    } catch (err: unknown) {
      setPhase({ step: "error", message: err instanceof Error ? err.message : "Failed to load" });
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("vitallink_donor_id");
    if (id && id.trim()) {
      load(id);
    } else {
      setPhase({ step: "no-id" });
    }
  }, [load]);

  // Subscribe to live match notifications for this donor
  useEffect(() => {
    if (phase.step !== "ready") return;
    const donorId = phase.donor.donor_id;

    subRef.current = subscribeToDonorMatches(donorId, () => {
      // New match arrived — refresh matches list and show alert
      setNewMatchAlert(true);
      getDonorMatches(donorId).then((updated) => {
        setPhase((prev) => (prev.step === "ready" ? { ...prev, matches: updated } : prev));
      }).catch(() => {});
      // Auto-dismiss alert after 5 seconds
      setTimeout(() => setNewMatchAlert(false), 5000);
    });

    // Polling fallback: refresh every 5s even if Supabase Realtime is unavailable
    let prevPendingCount = phase.step === "ready" ? phase.matches.pending.length : 0;
    const pollId = setInterval(() => {
      getDonorMatches(donorId).then((updated) => {
        setPhase((prev) => {
          if (prev.step !== "ready") return prev;
          if (updated.pending.length > prevPendingCount) {
            setNewMatchAlert(true);
            setTimeout(() => setNewMatchAlert(false), 5000);
          }
          prevPendingCount = updated.pending.length;
          return { ...prev, matches: updated };
        });
      }).catch(() => {});
    }, 5000);

    return () => {
      subRef.current?.();
      clearInterval(pollId);
    };
  }, [phase.step === "ready" ? phase.donor.donor_id : null]);

  async function handleToggleAvailable() {
    if (phase.step !== "ready") return;
    setToggling(true);
    setToggleError(null);
    try {
      const updated = await updateDonorAvailability(phase.donor.donor_id, !phase.donor.available);
      setPhase({ ...phase, donor: updated });
    } catch (err: unknown) {
      setToggleError(err instanceof Error ? err.message : "Failed to update");
    }
    setToggling(false);
  }

  async function handleRespond(matchId: string, response: "accepted" | "declined") {
    setRespondingId(matchId);
    setRespondError(null);
    try {
      await respondToMatch(matchId, response);
      if (phase.step === "ready") {
        const matches = await getDonorMatches(phase.donor.donor_id);
        setPhase({ ...phase, matches });
      }
    } catch (err: unknown) {
      setRespondError(err instanceof Error ? err.message : "Failed to send response");
    }
    setRespondingId(null);
  }

  // No donor ID in localStorage — show register prompt
  if (phase.step === "no-id") {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>&#127968;</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Welcome to VitalLink</h2>
            <p style={{ color: "#5C6D66", fontSize: "0.9rem", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
              You need to register as a donor first to access your dashboard.
            </p>
            <Link href="/donate/register" style={primaryBtn}>
              Register as a donor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (phase.step === "checking" || phase.step === "loading") {
    return (
      <div style={wrap}>
        <LoadingSpinner label="Loading your dashboard\u2026" />
      </div>
    );
  }

  // Error state
  if (phase.step === "error") {
    return (
      <div style={wrap}>
        <ErrorBanner
          message={phase.message}
          onRetry={() => {
            const id = localStorage.getItem("vitallink_donor_id");
            if (id) load(id);
          }}
        />
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href="/donate/register" style={{ color: TEAL, fontWeight: 500 }}>
            Register as a new donor
          </Link>
        </div>
      </div>
    );
  }

  const { donor, matches } = phase;
  const { pending, history, impact } = matches;

  return (
    <div style={wrap}>
      {/* New match alert */}
      {newMatchAlert && (
        <div style={alertBanner}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            New blood request — check your pending requests below
          </span>
        </div>
      )}

      {/* Welcome */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ ...avatar, backgroundColor: TEAL }}>
            {donor.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>
              Welcome, {donor.name.split(" ")[0]}
            </h1>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: "2px 0 0" }}>
              {donor.blood_type} donor &middot; {donor.available ? "Available" : "Paused"}
            </p>
          </div>
        </div>
        {donor.available && pending.length > 0 && (
          <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.85rem", borderRadius: 8, backgroundColor: "#FFF5F5", border: "1px solid #F5D0D0" }}>
            <span style={{ fontSize: "0.85rem", color: "#7A0A1D" }}>
              <strong>{pending.length} request{pending.length !== 1 ? "s" : ""}</strong> need your help right now
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={statsRow}>
        <StatBox label="Notified" value={impact.total_notified} color="#3B82F6" />
        <StatBox label="Accepted" value={impact.accepted} color={TEAL} />
        <StatBox label="Lives saved" value={impact.lives_potentially_saved} color={RED} />
      </div>

      {/* Availability */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>
              {donor.available ? "Available to donate" : "Paused"}
            </h3>
            <p style={{ color: "#5C6D66", fontSize: "0.8rem", margin: "2px 0 0" }}>
              {donor.available ? "You will receive notifications when someone needs your blood type." : "Toggle on to start receiving notifications again."}
            </p>
          </div>
          <button onClick={handleToggleAvailable} disabled={toggling} style={{ ...toggleBtn, backgroundColor: donor.available ? TEAL : "#D1D5DB" }}>
            <div style={{ ...toggleKnob, transform: donor.available ? "translateX(20px)" : "translateX(2px)" }} />
          </button>
        </div>
        {toggleError && <p style={errorText}>{toggleError}</p>}
      </div>

      {/* Pending requests */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Blood donation requests</h3>
          {pending.length > 0 && <span style={{ ...countBadge, backgroundColor: RED }}>{pending.length}</span>}
        </div>
        {pending.length === 0 ? (
          <div style={emptyCard}>
            <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>No pending requests</p>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
              No requests near you need {donor.blood_type} right now. We will notify you the moment you are needed.
            </p>
          </div>
        ) : (
          pending.map((m) => (
            <RequestCard
              key={m.match_id}
              match={m}
              responding={respondingId === m.match_id}
              onRespond={(r) => handleRespond(m.match_id, r)}
            />
          ))
        )}
        {respondError && <p style={errorText}>{respondError}</p>}
      </div>

      {/* History */}
      <div style={card}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Response history</h3>
        {history.length === 0 ? (
          <p style={{ color: "#5C6D66", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
            Your responses will appear here.
          </p>
        ) : (
          history.map((m) => (
            <div key={m.match_id}>
              <div style={historyRow}>
                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: m.response === "contact_shared" ? "#E4F1EE" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.75rem" }}>
                  {m.response === "contact_shared" ? "\u2713" : "\u2717"}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{m.blood_type}</span>
                  <span style={{ fontSize: "0.75rem", color: "#5C6D66", marginLeft: "0.5rem" }}>
                    {m.requester_name ?? "Requester"} &middot; {m.distance_km ?? "?"} km
                  </span>
                </div>
                <span style={{ fontSize: "0.7rem", color: m.response === "contact_shared" ? TEAL : "#9CA3AF", fontWeight: 600, textTransform: "uppercase" as const }}>
                  {m.response === "contact_shared" ? "confirmed" : m.response}
                </span>
                {m.response === "contact_shared" && (
                  <button
                    onClick={() => {
                      seenMessages.current.set(m.match_id, m.message_count);
                      setChatMatchId(m.match_id);
                    }}
                    style={{ ...chatBtn, position: "relative" }}
                  >
                    Chat
                    {(m.message_count - (seenMessages.current.get(m.match_id) ?? 0)) > 0 && (
                      <span style={chatBadge}>{m.message_count - (seenMessages.current.get(m.match_id) ?? 0)}</span>
                    )}
                  </button>
                )}
              </div>
              {m.response === "contact_shared" && (
                <div style={acceptedNotice}>
                  <span style={{ fontSize: "0.8rem", color: "#1B7F79" }}>
                    Contact info shared. Use Chat to coordinate your donation.
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Chat modal */}
      {chatMatchId && (
        <ChatModal matchId={chatMatchId} senderType="donor" senderId={phase.step === "ready" ? phase.donor.donor_id : null} onClose={() => setChatMatchId(null)} />
      )}

      {/* Nav */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <Link href="/donate" style={linkBtn}>&larr; Donate</Link>
        <Link href="/live" style={linkBtn}>Live dashboard</Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request card
// ---------------------------------------------------------------------------
function RequestCard({ match, responding, onRespond }: {
  match: DonorMatchEntry;
  responding: boolean;
  onRespond: (r: "accepted" | "declined") => void;
}) {
  const bg: Record<string, string> = { critical: "#FEF2F2", high: "#FFFBEB", routine: "#F0FAF8" };

  return (
    <div style={{ ...requestCard, backgroundColor: bg[match.urgency] ?? "#FAFBFC" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{match.blood_type}</span>
          <UrgencyBadge urgency={match.urgency} />
        </div>
        <span style={{ fontSize: "0.75rem", color: "#5C6D66" }}>
          {match.units_needed} unit{match.units_needed !== 1 ? "s" : ""}
        </span>
      </div>
      <p style={{ fontSize: "0.8rem", color: "#5C6D66", margin: "0 0 0.75rem" }}>
        <strong>{match.requester_name ?? "Requester"}</strong>
        {match.distance_km != null && <> &middot; {match.distance_km} km away</>}
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={() => onRespond("accepted")} disabled={responding} style={{ ...acceptBtn, opacity: responding ? 0.6 : 1 }}>
          {responding ? "Sending\u2026" : "I can help"}
        </button>
        <button onClick={() => onRespond("declined")} disabled={responding} style={{ ...declineBtn, opacity: responding ? 0.6 : 1 }}>
          Not now
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "0.7rem", color: "#5C6D66", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const wrap: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  padding: "1.5rem 1rem",
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};

const card: React.CSSProperties = {
  padding: "1.25rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
  marginBottom: "0.75rem",
};

const avatar: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", fontSize: "1.15rem", fontWeight: 700, flexShrink: 0,
};

const statsRow: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginBottom: "0.75rem",
};

const statBox: React.CSSProperties = {
  padding: "0.85rem", border: "1px solid #D8DFDA", borderRadius: 10,
  backgroundColor: "#fff", textAlign: "center",
};

const toggleBtn: React.CSSProperties = {
  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
  position: "relative", flexShrink: 0, transition: "background-color 0.2s",
};

const toggleKnob: React.CSSProperties = {
  width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff",
  position: "absolute", top: 2, transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
};

const countBadge: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: 20, height: 20, borderRadius: 10, color: "#fff",
  fontSize: "0.7rem", fontWeight: 700, padding: "0 6px",
};

const requestCard: React.CSSProperties = {
  padding: "1rem", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: "0.5rem",
};

const acceptBtn: React.CSSProperties = {
  flex: 1, padding: "0.6rem", border: "none", borderRadius: 8,
  backgroundColor: TEAL, color: "#fff", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
};

const declineBtn: React.CSSProperties = {
  flex: 1, padding: "0.6rem", border: "1px solid #D1D5DB", borderRadius: 8,
  backgroundColor: "#fff", color: "#6B7280", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer",
};

const chatBtn: React.CSSProperties = {
  padding: "0.25rem 0.6rem", border: "1px solid #1B7F79", borderRadius: 6,
  backgroundColor: "#fff", color: "#1B7F79", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
  marginLeft: "0.5rem", whiteSpace: "nowrap",
};

const chatBadge: React.CSSProperties = {
  position: "absolute", top: -6, right: -6, minWidth: 16, height: 16,
  borderRadius: 8, backgroundColor: "#C8102E", color: "#fff",
  fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center",
  justifyContent: "center", padding: "0 4px",
};

const emptyCard: React.CSSProperties = {
  textAlign: "center", padding: "1.5rem 1rem", backgroundColor: "#F0FAF8",
  borderRadius: 8, border: "1px dashed #B2DFDB",
};

const historyRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.75rem",
  padding: "0.5rem 0", borderBottom: "1px solid #F3F4F6",
};

const acceptedNotice: React.CSSProperties = {
  padding: "0.4rem 0.75rem", marginBottom: "0.5rem",
  backgroundColor: "#E4F1EE", borderRadius: 6,
  border: "1px solid #B2DFDB",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-block", padding: "0.7rem 1.5rem", backgroundColor: TEAL, color: "#fff",
  borderRadius: 8, fontWeight: 600, fontSize: "0.9rem", textDecoration: "none",
};

const linkBtn: React.CSSProperties = {
  flex: 1, textAlign: "center", padding: "0.6rem", border: "1px solid #D8DFDA",
  borderRadius: 8, backgroundColor: "#fff", color: "#374151",
  fontSize: "0.85rem", fontWeight: 500, textDecoration: "none",
};

const errorText: React.CSSProperties = {
  color: "#7A0A1D", fontSize: "0.8rem", margin: "0.5rem 0 0",
  backgroundColor: "#FEE2E2", padding: "0.4rem 0.75rem", borderRadius: 6,
};

const alertBanner: React.CSSProperties = {
  padding: "0.75rem 1rem", borderRadius: 10,
  backgroundColor: "#FFF5F5", border: "1px solid #F5D0D0",
  marginBottom: "0.75rem", textAlign: "center",
  animation: "pulse-bg 2s ease-in-out infinite",
};
