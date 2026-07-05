/**
 * RequestDashboard — Match status panel for a specific request.
 *
 * Shows ranked candidate donors, accepted matches, and live status.
 * Subscribes to Supabase Realtime for live match updates.
 * Supports requester-side accept and donor-side confirm/decline.
 */
"use client";

import { useEffect, useState } from "react";
import {
  getRequestMatches,
  acceptDonor,
  respondToMatch,
  getMessages,
  sendMessage,
  updateRequestStatus,
  type RequestWithMatches,
  type MatchDetail,
  type ChatMessage,
} from "@/lib/api";
import { subscribeToMatches } from "@/lib/supabase";
import { StatusBadge, LiveIndicator } from "@/components/shared";

const TEAL = "#1B7F79";
const RED = "#C8102E";

interface Props {
  requestId: string;
  role?: "requester" | "donor";
  userId?: string;
  onBack?: () => void;
}

export default function RequestDashboard({ requestId, role = "requester", userId, onBack }: Props) {
  const [data, setData] = useState<RequestWithMatches | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [chatMatchId, setChatMatchId] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    let active = true;
    getRequestMatches(requestId)
      .then((res) => { if (active) setData(res); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [requestId]);

  // Supabase Realtime subscription
  useEffect(() => {
    const unsub = subscribeToMatches(requestId, () => {
      getRequestMatches(requestId)
        .then((updated) => setData(updated))
        .catch(() => {});
    });
    return unsub;
  }, [requestId]);

  async function handleAcceptDonor(donorId: string) {
    setAcceptingId(donorId);
    setAcceptError(null);
    try {
      await acceptDonor(requestId, donorId);
      const updated = await getRequestMatches(requestId);
      setData(updated);
    } catch (err: unknown) {
      setAcceptError(err instanceof Error ? err.message : "Failed to accept donor");
    }
    setAcceptingId(null);
  }

  async function handleDonorRespond(matchId: string, response: "accepted" | "declined") {
    setAcceptingId(matchId);
    try {
      await respondToMatch(matchId, response);
      const updated = await getRequestMatches(requestId);
      setData(updated);
    } catch { /* retry */ }
    setAcceptingId(null);
  }

  if (error) return <div style={card}><p style={{ color: "#dc2626" }}>{error}</p></div>;
  if (!data) return <div style={card}><p>Loading\u2026</p></div>;

  const confirmed = data.matches.filter((m) => m.response === "donor_confirmed" || m.response === "contact_shared").length;
  const pending = data.matches.filter((m) => m.response === "accepted_by_requester" || m.response === "pending").length;
  const accepted = data.matches.filter((m) => m.response !== "declined").length;

  return (
    <div style={card}>
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
            {data.units_needed} unit{data.units_needed !== 1 ? "s" : ""} needed &middot; {data.urgency}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </div>

      {/* Summary */}
      <div style={summaryRow}>
        <StatCard label="Matched" value={data.matches.length} color="#2563eb" />
        <StatCard label="Confirmed" value={confirmed} color={TEAL} />
        <StatCard label="Pending" value={pending} color="#f59e0b" />
      </div>

      {/* Contact shared notice */}
      {data.status === "contact_shared" && (
        <div style={sharedNotice}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#1B7F79", lineHeight: 1.4 }}>
            Contact info has been shared with confirmed donors. You can now coordinate directly.
          </p>
        </div>
      )}

      {/* Confirmed matches */}
      {confirmed > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>
            Confirmed Donors
          </h4>
          {data.matches
            .filter((m) => m.response === "donor_confirmed" || m.response === "contact_shared")
            .map((m) => (
              <DonorRow
                key={m.match_id}
                match={m}
                role={role}
                userId={userId}
                onChat={() => setChatMatchId(m.match_id)}
                onRespond={(r) => handleDonorRespond(m.match_id, r)}
                responding={acceptingId === m.match_id}
              />
            ))}
        </div>
      )}

      {/* Pending matches */}
      {pending > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>
            Awaiting Confirmation
          </h4>
          {data.matches
            .filter((m) => m.response === "accepted_by_requester" || m.response === "pending")
            .map((m) => (
              <DonorRow
                key={m.match_id}
                match={m}
                role={role}
                userId={userId}
                onRespond={(r) => handleDonorRespond(m.match_id, r)}
                responding={acceptingId === m.match_id}
              />
            ))}
        </div>
      )}

      {acceptError && (
        <p style={{ color: "#dc2626", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>{acceptError}</p>
      )}

      {data.matches.length === 0 && (
        <p style={{ color: "#6b7280", textAlign: "center", padding: "1.5rem 0" }}>
          No donors matched yet.
        </p>
      )}

      <div style={{ marginTop: "1rem" }}>
        <LiveIndicator color={TEAL} label="Live updates via Supabase Realtime" />
      </div>

      {/* Chat modal */}
      {chatMatchId && (
        <ChatModal matchId={chatMatchId} onClose={() => setChatMatchId(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function DonorRow({
  match,
  role,
  userId,
  onChat,
  onRespond,
  responding,
}: {
  match: MatchDetail;
  role: string;
  userId?: string;
  onChat?: () => void;
  onRespond?: (r: "accepted" | "declined") => void;
  responding: boolean;
}) {
  const isContactShared = match.response === "contact_shared";
  const isDonorPending = role === "donor" && match.response === "accepted_by_requester";

  return (
    <div style={donorRow}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
        <div style={avatar}>
          {(match.donor_name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            {match.donor_name ?? match.donor_id.slice(0, 8)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
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
        {isContactShared && onChat && (
          <button onClick={onChat} style={chatBtn}>Chat</button>
        )}
        {isDonorPending && onRespond && (
          <>
            <button
              onClick={() => onRespond("accepted")}
              disabled={responding}
              style={confirmBtn}
            >
              Confirm
            </button>
            <button
              onClick={() => onRespond("declined")}
              disabled={responding}
              style={declineBtn}
            >
              Decline
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ResponseChip({ response }: { response: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "#F3F4F6", fg: "#6B7280" },
    accepted_by_requester: { bg: "#FEF3C7", fg: "#92400e" },
    donor_confirmed: { bg: "#E4F1EE", fg: "#1B7F79" },
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

function ChatModal({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const requesterId = typeof window !== "undefined" ? localStorage.getItem("vitallink_requester_id") ?? "" : "";
  const donorId = typeof window !== "undefined" ? localStorage.getItem("vitallink_donor_id") ?? "" : "";

  const senderType = requesterId ? "requester" : "donor";
  const senderId = requesterId || donorId;

  useEffect(() => {
    setLoading(true);
    getMessages(matchId)
      .then((msgs) => { setMessages(msgs); setLoading(false); })
      .catch(() => setLoading(false));
  }, [matchId]);

  async function handleSend() {
    if (!input.trim() || !senderId) return;
    setSending(true);
    try {
      const msg = await sendMessage(matchId, senderType as "requester" | "donor", senderId, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch { /* retry */ }
    setSending(false);
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Chat</h3>
          <button onClick={onClose} style={closeBtn}>&times;</button>
        </div>

        <div style={chatArea}>
          {loading ? (
            <p style={{ color: "#5C6D66", textAlign: "center", padding: "1rem" }}>Loading\u2026</p>
          ) : messages.length === 0 ? (
            <p style={{ color: "#5C6D66", textAlign: "center", padding: "1rem", fontSize: "0.85rem" }}>
              No messages yet. Say hello!
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.message_id} style={{
                ...chatBubble,
                alignSelf: m.sender_type === senderType ? "flex-end" : "flex-start",
                backgroundColor: m.sender_type === senderType ? TEAL : "#F3F4F6",
                color: m.sender_type === senderType ? "#fff" : "#14231F",
              }}>
                {m.body}
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="Type a message..."
            style={chatInput}
          />
          <button onClick={handleSend} disabled={sending || !input.trim()} style={sendBtn}>
            {sending ? "\u2026" : "\u2191"}
          </button>
        </div>
      </div>
    </div>
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const card: React.CSSProperties = {
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

const sharedNotice: React.CSSProperties = {
  padding: "0.65rem 0.85rem",
  backgroundColor: "#E4F1EE",
  border: "1px solid #B2DFDB",
  borderRadius: 8,
  marginTop: "0.75rem",
};

const donorRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.65rem 0.75rem",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  marginBottom: "0.5rem",
  backgroundColor: "#FAFBFC",
};

const avatar: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#1B7F79",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.8rem",
  fontWeight: 700,
  flexShrink: 0,
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

const confirmBtn: React.CSSProperties = {
  padding: "0.3rem 0.75rem",
  border: "none",
  borderRadius: 6,
  backgroundColor: TEAL,
  color: "#fff",
  fontSize: "0.75rem",
  fontWeight: 600,
  cursor: "pointer",
};

const declineBtn: React.CSSProperties = {
  padding: "0.3rem 0.75rem",
  border: "1px solid #D1D5DB",
  borderRadius: 6,
  backgroundColor: "#fff",
  color: "#6B7280",
  fontSize: "0.75rem",
  fontWeight: 500,
  cursor: "pointer",
};

// Chat modal
const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "1rem",
};

const modalContent: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  maxHeight: "80vh",
  backgroundColor: "#fff",
  borderRadius: 12,
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "1.5rem",
  color: "#6B7280",
  cursor: "pointer",
  padding: 0,
  lineHeight: 1,
};

const chatArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  minHeight: 200,
  maxHeight: 400,
  padding: "0.5rem 0",
};

const chatBubble: React.CSSProperties = {
  maxWidth: "80%",
  padding: "0.5rem 0.75rem",
  borderRadius: 12,
  fontSize: "0.85rem",
  lineHeight: 1.4,
};

const chatInput: React.CSSProperties = {
  flex: 1,
  padding: "0.5rem 0.75rem",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  fontSize: "0.85rem",
};

const sendBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: "none",
  backgroundColor: TEAL,
  color: "#fff",
  fontSize: "1rem",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
