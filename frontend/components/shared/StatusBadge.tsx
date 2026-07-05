/**
 * StatusBadge — request lifecycle status pill.
 *
 * Used in the hospital dashboard request list and the request dashboard
 * component to show open / donors_notified / fulfilled / closed.
 */

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open:                { bg: "#dbeafe", fg: "#1e40af" },
  donors_notified:     { bg: "#fef3c7", fg: "#92400e" },
  partially_fulfilled: { bg: "#fed7aa", fg: "#9a3412" },
  fulfilled:           { bg: "#bbf7d0", fg: "#166534" },
  closed:              { bg: "#e5e7eb", fg: "#374151" },
};

interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const c = STATUS_COLORS[status] ?? { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span
      style={{
        padding: "0.25rem 0.75rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.fg,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
