"use client";

import { useEffect, useState, useRef } from "react";
import { getMessages, sendMessage, type ChatMessage } from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";

const TEAL = "#1B7F79";

export default function ChatModal({
  matchId,
  senderType,
  senderId,
  onClose,
}: {
  matchId: string;
  senderType: "requester" | "donor";
  senderId: string | null;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const msgs = await getMessages(matchId);
      setMessages(msgs);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const pollId = setInterval(load, 3000);
    return () => clearInterval(pollId);
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !senderId) return;
    setSending(true);
    try {
      const msg = await sendMessage(matchId, senderType, senderId, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch {
      /* retry on next poll */
    }
    setSending(false);
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Chat</h3>
          <button onClick={onClose} style={closeBtn}>&times;</button>
        </div>

        <div style={chatArea}>
          {loading ? (
            <LoadingSpinner label="Loading messages\u2026" />
          ) : messages.length === 0 ? (
            <p style={{ color: "#5C6D66", textAlign: "center", padding: "1rem", fontSize: "0.85rem" }}>
              No messages yet. Say hello!
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.message_id}
                style={{
                  ...bubble,
                  alignSelf: m.sender_type === senderType ? "flex-end" : "flex-start",
                  backgroundColor: m.sender_type === senderType ? TEAL : "#F3F4F6",
                  color: m.sender_type === senderType ? "#fff" : "#14231F",
                }}
              >
                {m.body}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div style={inputRow}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="Type a message..."
            disabled={!senderId}
            style={chatInput}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim() || !senderId}
            style={sendBtn}
          >
            {sending ? "\u2026" : "\u2191"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "1rem",
};

const modal: React.CSSProperties = {
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

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.75rem",
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

const bubble: React.CSSProperties = {
  maxWidth: "80%",
  padding: "0.5rem 0.75rem",
  borderRadius: 12,
  fontSize: "0.85rem",
  lineHeight: 1.4,
};

const inputRow: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  marginTop: "0.5rem",
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
