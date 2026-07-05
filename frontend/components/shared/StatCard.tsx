/**
 * StatCard — single metric with label and optional sub-text.
 *
 * Used across all three route groups to display counts like
 * "Donors notified", "Accepted", "Pending", etc.
 */
const COLORS = {
  text: "#14231F",
  muted: "#5C6D66",
  card: "#fff",
  border: "#D8DFDA",
} as const;

interface Props {
  label: string;
  value: number;
  sub?: string;
  color?: string;
}

export default function StatCard({ label, value, sub, color }: Props) {
  return (
    <div style={wrap}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: color ?? COLORS.text }}>{value}</div>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: COLORS.text }}>{label}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: COLORS.muted }}>{sub}</div>}
    </div>
  );
}

const wrap: React.CSSProperties = {
  textAlign: "center",
  padding: "0.85rem 0.5rem",
  backgroundColor: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 10,
};
