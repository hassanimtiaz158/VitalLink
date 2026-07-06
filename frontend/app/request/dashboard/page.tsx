/**
 * Requester dashboard — shows candidate donors, accepted matches, and contact info.
 *
 * URL: /request/dashboard?id=<requestId>
 * Uses localStorage for requester identity. Shows ranked candidate donors
 * with accept buttons, and reveals contact info once both sides confirm.
 */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  getCandidateDonors,
  acceptDonor,
  getRequestMatches,
  updateRequestStatus,
  type CandidateDonor,
  type RequestWithMatches,
  type MatchDetail,
} from "@/lib/api";
import { subscribeToMatches } from "@/lib/supabase";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBanner from "@/components/ErrorBanner";
import ChatModal from "@/components/ChatModal";
import { StatusBadge, UrgencyBadge, LiveIndicator } from "@/components/shared";

const TEAL = "#1B7F79";
const RED = "#C8102E";

type Phase =
  | { step: "loading" }
  | { step: "error"; message: string }
  | { step: "no-request" }
  | { step: "selecting"; candidates: CandidateDonor[]; request: RequestWithMatches }
  | { step: "tracking"; request: RequestWithMatches };

export default function RequestDashboardPage() {
  const [phase, setPhase] = useState<Phase>({ step: "loading" });
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const refreshRequest = useCallback(async (requestId: string) => {
    try {
      const request = await getRequestMatches(requestId);
      if (request.matched_donors === 0) {
        const candidates = await getCandidateDonors(requestId);
        setPhase({ step: "selecting", candidates, request });
      } else {
        setPhase({ step: "tracking", request });
      }
    } catch {
      // silent
    }
  }, []);

  const loadRequest = useCallback(async (requestId: string) => {
    setPhase({ step: "loading" });
    try {
      const request = await getRequestMatches(requestId);
      if (request.matched_donors === 0) {
        const candidates = await getCandidateDonors(requestId);
        setPhase({ step: "selecting", candidates, request });
      } else {
        setPhase({ step: "tracking", request });
      }
    } catch (err: unknown) {
      setPhase({ step: "error", message: err instanceof Error ? err.message : "Failed to load" });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("id");
    if (requestId) {
      loadRequest(requestId);
    } else {
      setPhase({ step: "no-request" });
    }
  }, [loadRequest]);

  // Realtime subscription + polling fallback
  useEffect(() => {
    if (phase.step === "tracking") {
      const reqId = phase.request.request_id;
      const unsub = subscribeToMatches(reqId, () => {
        refreshRequest(reqId);
      });
      const pollId = setInterval(() => {
        refreshRequest(reqId);
      }, 5000);
      return () => {
        unsub();
        clearInterval(pollId);
      };
    }
  }, [phase.step === "tracking" ? phase.request.request_id : null]);

  async function handleAccept(donorId: string) {
    if (phase.step !== "selecting") return;
    setAcceptingId(donorId);
    setAcceptError(null);
    try {
      await acceptDonor(phase.request.request_id, donorId);
      // Refresh — this request now has matches
      await loadRequest(phase.request.request_id);
    } catch (err: unknown) {
      setAcceptError(err instanceof Error ? err.message : "Failed to accept donor");
    }
    setAcceptingId(null);
  }

  async function handleAcceptFromTracking(donorId: string) {
    if (phase.step !== "tracking") return;
    setAcceptingId(donorId);
    setAcceptError(null);
    try {
      await acceptDonor(phase.request.request_id, donorId);
      await loadRequest(phase.request.request_id);
    } catch (err: unknown) {
      setAcceptError(err instanceof Error ? err.message : "Failed to accept donor");
    }
    setAcceptingId(null);
  }

  if (phase.step === "loading") {
    return <div style={wrap}><LoadingSpinner label="Loading dashboard\u2026" /></div>;
  }

  if (phase.step === "error") {
    return (
      <div style={wrap}>
        <ErrorBanner
          message={phase.message}
          onRetry={() => {
            const params = new URLSearchParams(window.location.search);
            const id = params.get("id");
            if (id) loadRequest(id);
          }}
        />
      </div>
    );
  }

  if (phase.step === "no-request") {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>&#127968;</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>No active request</h2>
            <p style={{ color: "#5C6D66", fontSize: "0.9rem", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
              Create a blood request to find donors near you.
            </p>
            <Link href="/request" style={primaryBtn}>
              Create a request
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase.step === "selecting") {
    return (
      <SelectingView
        candidates={phase.candidates}
        request={phase.request}
        acceptingId={acceptingId}
        acceptError={acceptError}
        onAccept={handleAccept}
        onRefresh={() => loadRequest(phase.request.request_id)}
      />
    );
  }

  return (
    <TrackingView
      request={phase.request}
      acceptingId={acceptingId}
      acceptError={acceptError}
      onAccept={handleAcceptFromTracking}
      onRefresh={() => loadRequest(phase.request.request_id)}
    />
  );
}

// ---------------------------------------------------------------------------
// SelectingView — show ranked candidate donors with accept buttons
// ---------------------------------------------------------------------------
function SelectingView({
  candidates,
  request,
  acceptingId,
  acceptError,
  onAccept,
  onRefresh,
}: {
  candidates: CandidateDonor[];
  request: RequestWithMatches;
  acceptingId: string | null;
  acceptError: string | null;
  onAccept: (donorId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
              {request.blood_type} &middot; {request.units_needed} unit{request.units_needed !== 1 ? "s" : ""}
            </h2>
            <p style={{ margin: "0.25rem 0 0", color: "#5C6D66", fontSize: "0.85rem" }}>
              <UrgencyBadge urgency={request.urgency} />
              <span style={{ marginLeft: "0.5rem" }}><StatusBadge status={request.status} /></span>
            </p>
          </div>
          <Link href="/request" style={{ color: TEAL, fontSize: "0.85rem", fontWeight: 500 }}>
            New request
          </Link>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
            Candidate donors ({candidates.length})
          </h3>
          <button onClick={onRefresh} style={refreshBtn}>Refresh</button>
        </div>
        <p style={{ color: "#5C6D66", fontSize: "0.8rem", margin: "0 0 0.75rem", lineHeight: 1.4 }}>
          Donors ranked by distance and compatibility. Accept the ones you want — they will be notified by email.
        </p>

        {candidates.length === 0 ? (
          <div style={emptyCard}>
            <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>No candidates found</p>
            <p style={{ color: "#5C6D66", fontSize: "0.85rem", margin: 0 }}>
              No compatible donors are available in your area right now.
            </p>
          </div>
        ) : (
          candidates.map((c) => (
            <DonorSelectCard
              key={c.donor_id}
              donor={c}
              accepting={acceptingId === c.donor_id}
              onAccept={() => onAccept(c.donor_id)}
            />
          ))
        )}

        {acceptError && <p style={errorText}>{acceptError}</p>}
      </div>

      <LiveIndicator color={TEAL} label="Live updates" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrackingView — show accepted matches, status, contact info
// ---------------------------------------------------------------------------
function TrackingView({
  request,
  acceptingId,
  acceptError,
  onAccept,
  onRefresh,
}: {
  request: RequestWithMatches;
  acceptingId: string | null;
  acceptError: string | null;
  onAccept: (donorId: string) => void;
  onRefresh: () => void;
}) {
  const [chatMatchId, setChatMatchId] = useState<string | null>(null);
  const requesterId = typeof window !== "undefined" ? localStorage.getItem("vitallink_requester_id") ?? "" : "";
  const seenMessages = useRef<Map<string, number>>(new Map());

  const confirmed = request.matches.filter((m) => m.response === "contact_shared").length;
  const pending = request.matches.filter((m) => m.response === "accepted_by_requester" || m.response === "pending").length;

  function handleOpenChat(matchId: string, messageCount: number) {
    seenMessages.current.set(matchId, messageCount);
    setChatMatchId(matchId);
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
              {request.blood_type} &middot; {request.units_needed} unit{request.units_needed !== 1 ? "s" : ""}
            </h2>
            <p style={{ margin: "0.25rem 0 0", color: "#5C6D66", fontSize: "0.85rem" }}>
              <UrgencyBadge urgency={request.urgency} />
              <span style={{ marginLeft: "0.5rem" }}><StatusBadge status={request.status} /></span>
            </p>
          </div>
          <Link href="/request" style={{ color: TEAL, fontSize: "0.85rem", fontWeight: 500 }}>
            New request
          </Link>
        </div>

        {/* Summary */}
        <div style={statsRow}>
          <StatBox label="Matched" value={request.matches.length} color="#3B82F6" />
          <StatBox label="Confirmed" value={confirmed} color={TEAL} />
          <StatBox label="Pending" value={pending} color="#F59E0B" />
        </div>
      </div>

      {/* Confirmed donors — with contact info */}
      {confirmed > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
            Confirmed donors ({confirmed})
          </h3>
          {request.matches
            .filter((m) => m.response === "contact_shared")
            .map((m) => (
              <MatchCard
                key={m.match_id}
                match={m}
                unreadCount={m.message_count - (seenMessages.current.get(m.match_id) ?? 0)}
                onChat={() => handleOpenChat(m.match_id, m.message_count)}
              />
            ))}
        </div>
      )}

      {/* Pending — accepted but awaiting donor confirmation */}
      {pending > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
            Waiting for confirmation ({pending})
          </h3>
          {request.matches
            .filter((m) => m.response === "accepted_by_requester" || m.response === "pending")
            .map((m) => (
              <PendingCard key={m.match_id} match={m} />
            ))}
        </div>
      )}

      {acceptError && <p style={errorText}>{acceptError}</p>}

      {/* Chat modal */}
      {chatMatchId && (
        <ChatModal matchId={chatMatchId} senderType="requester" senderId={requesterId} onClose={() => setChatMatchId(null)} />
      )}

      <div style={{ marginTop: "1rem" }}>
        <LiveIndicator color={TEAL} label="Live updates via Supabase Realtime" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function DonorSelectCard({
  donor,
  accepting,
  onAccept,
}: {
  donor: CandidateDonor;
  accepting: boolean;
  onAccept: () => void;
}) {
  return (
    <div style={donorCard}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
        <div style={avatar}>{donor.name.charAt(0).toUpperCase()}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{donor.name}</div>
          <div style={{ fontSize: "0.75rem", color: "#5C6D66" }}>
            {donor.blood_type} &middot; {donor.distance_km} km
          </div>
          {donor.last_donation_date && (
            <div style={{ fontSize: "0.7rem", color: "#9CA3AF" }}>
              Last donated: {new Date(donor.last_donation_date).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onAccept}
        disabled={accepting}
        style={{ ...acceptBtn, opacity: accepting ? 0.6 : 1 }}
      >
        {accepting ? "Sending\u2026" : "Accept"}
      </button>
    </div>
  );
}

function MatchCard({ match, unreadCount, onChat }: { match: MatchDetail; unreadCount: number; onChat: () => void }) {
  const isContactShared = match.response === "contact_shared";
  return (
    <div style={matchCard}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
        <div style={{ ...avatar, backgroundColor: TEAL }}>
          {(match.donor_name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            {match.donor_name ?? match.donor_id.slice(0, 8)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#5C6D66" }}>
            {match.donor_blood_type} &middot; {match.distance_km ?? "?"} km
          </div>
          {isContactShared && (match.donor_email || match.donor_phone) && (
            <div style={{ fontSize: "0.75rem", color: TEAL, marginTop: "2px" }}>
              {match.donor_email && <span>{match.donor_email}</span>}
              {match.donor_email && match.donor_phone && <span> &middot; </span>}
              {match.donor_phone && <span>{match.donor_phone}</span>}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <ResponseChip response={match.response} />
        {isContactShared && (
          <button onClick={onChat} style={{ ...chatBtn, position: "relative" }}>
            Chat
            {unreadCount > 0 && (
              <span style={chatBadge}>{unreadCount}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function PendingCard({ match }: { match: MatchDetail }) {
  return (
    <div style={matchCard}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
        <div style={{ ...avatar, backgroundColor: "#F59E0B" }}>
          {(match.donor_name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            {match.donor_name ?? match.donor_id.slice(0, 8)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#5C6D66" }}>
            {match.donor_blood_type} &middot; {match.distance_km ?? "?"} km
          </div>
          <div style={{ fontSize: "0.7rem", color: "#F59E0B" }}>
            Waiting for donor to confirm...
          </div>
        </div>
      </div>
      <ResponseChip response={match.response} />
    </div>
  );
}

function ResponseChip({ response }: { response: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "#F3F4F6", fg: "#6B7280" },
    accepted_by_requester: { bg: "#FEF3C7", fg: "#92400e" },
    contact_shared: { bg: "#E4F1EE", fg: "#1B7F79" },
    declined: { bg: "#FEE2E2", fg: "#7A0A1D" },
  };
  const c = colors[response] ?? { bg: "#F3F4F6", fg: "#6B7280" };
  const label = response.replace(/_/g, " ");
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: c.fg, backgroundColor: c.bg, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>
      {label}
    </span>
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
  width: 40,
  height: 40,
  borderRadius: 10,
  backgroundColor: "#1B7F79",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.9rem",
  fontWeight: 700,
  flexShrink: 0,
};

const donorCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.65rem 0.75rem",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  marginBottom: "0.5rem",
  backgroundColor: "#FAFBFC",
};

const matchCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.75rem",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  marginBottom: "0.5rem",
  backgroundColor: "#FAFBFC",
};

const acceptBtn: React.CSSProperties = {
  padding: "0.4rem 1rem",
  border: "none",
  borderRadius: 6,
  backgroundColor: RED,
  color: "#fff",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const chatBtn: React.CSSProperties = {
  padding: "0.3rem 0.75rem",
  border: `1px solid ${TEAL}`,
  borderRadius: 6,
  backgroundColor: "#fff",
  color: TEAL,
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
};

const chatBadge: React.CSSProperties = {
  position: "absolute", top: -6, right: -6, minWidth: 16, height: 16,
  borderRadius: 8, backgroundColor: RED, color: "#fff",
  fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center",
  justifyContent: "center", padding: "0 4px",
};

const refreshBtn: React.CSSProperties = {
  padding: "0.3rem 0.75rem",
  border: "1px solid #D1D5DB",
  borderRadius: 6,
  backgroundColor: "#fff",
  color: "#374151",
  fontSize: "0.75rem",
  fontWeight: 500,
  cursor: "pointer",
};

const statsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "0.5rem",
  marginTop: "0.75rem",
};

const statBox: React.CSSProperties = {
  padding: "0.75rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
  textAlign: "center",
};

const emptyCard: React.CSSProperties = {
  textAlign: "center",
  padding: "1.5rem 1rem",
  backgroundColor: "#F0FAF8",
  borderRadius: 8,
  border: "1px dashed #B2DFDB",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "0.7rem 1.5rem",
  backgroundColor: RED,
  color: "#fff",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.9rem",
  textDecoration: "none",
};

const errorText: React.CSSProperties = {
  color: "#7A0A1D",
  fontSize: "0.8rem",
  margin: "0.5rem 0 0",
  backgroundColor: "#FEE2E2",
  padding: "0.4rem 0.75rem",
  borderRadius: 6,
};


