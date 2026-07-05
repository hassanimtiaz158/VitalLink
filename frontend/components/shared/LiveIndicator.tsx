/**
 * LiveIndicator — pulsing dot with optional label.
 *
 * Used in the hospital layout, patient status page, and request
 * dashboard to show that data is updating in real time.
 */

interface Props {
  color?: string;
  label?: string;
}

export default function LiveIndicator({ color = "#1B7F79", label }: Props) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: color,
          animation: "blink 1.6s infinite",
          flexShrink: 0,
        }}
      />
      {label && <span style={{ fontSize: "0.75rem", color: "#5C6D66" }}>{label}</span>}
    </span>
  );
}
