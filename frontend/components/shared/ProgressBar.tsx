/**
 * ProgressBar — horizontal fill bar.
 *
 * Used in the patient status page and request dashboard to show
 * how many donors have accepted vs units needed.
 */

interface Props {
  /** 0–100 */
  percent: number;
  color?: string;
}

export default function ProgressBar({ percent, color }: Props) {
  const bg = color ?? "#C77E1B";
  return (
    <div style={track}>
      <div
        style={{
          ...fill,
          width: `${Math.min(Math.max(percent, 0), 100)}%`,
          backgroundColor: bg,
        }}
      />
    </div>
  );
}

const track: React.CSSProperties = {
  height: 8,
  backgroundColor: "#E5E7EB",
  borderRadius: 4,
  overflow: "hidden",
};

const fill: React.CSSProperties = {
  height: "100%",
  borderRadius: 4,
  transition: "width 0.5s ease",
};
