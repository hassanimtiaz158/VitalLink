/**
 * ResponseChip — accepted / declined / pending status chip.
 *
 * Reused in patient status, donor dashboard, and request dashboard
 * to show a donor's response to a match notification.
 */
const TEAL = "#1B7F79";
const AMBER = "#C77E1B";

const CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  accepted: { bg: "#E4F1EE", color: TEAL, label: "Accepted" },
  declined: { bg: "#F3F4F6", color: "#6B7280", label: "Declined" },
  pending:  { bg: "#FEF3C7", color: AMBER, label: "Not yet replied" },
};

interface Props {
  response: string;
}

export default function ResponseChip({ response }: Props) {
  const c = CONFIG[response] ?? CONFIG.pending;
  return (
    <span style={{ padding: "0.15rem 0.5rem", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600, backgroundColor: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}
