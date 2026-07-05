/**
 * UrgencyBadge — critical / high / routine colour chip.
 *
 * Used in the hospital dashboard request list, donor dashboard
 * match cards, and request dashboard.
 */

const URGENCY_COLORS: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "#fecaca", fg: "#991b1b" },
  high:     { bg: "#fef3c7", fg: "#92400e" },
  routine:  { bg: "#bbf7d0", fg: "#166534" },
};

interface Props {
  urgency: string;
}

export default function UrgencyBadge({ urgency }: Props) {
  const c = URGENCY_COLORS[urgency] ?? { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span
      style={{
        padding: "0.15rem 0.5rem",
        borderRadius: 4,
        fontSize: "0.7rem",
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.fg,
        textTransform: "capitalize",
      }}
    >
      {urgency}
    </span>
  );
}
