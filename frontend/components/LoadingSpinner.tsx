interface Props {
  label?: string;
}

export default function LoadingSpinner({ label = "Loading\u2026" }: Props) {
  return (
    <div style={wrap}>
      <div style={spinner} />
      <p style={labelStyle}>{label}</p>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2.5rem 1rem",
};

const spinner: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "3px solid #D8DFDA",
  borderTopColor: "#1B7F79",
  borderRadius: "50%",
  animation: "spin 0.7s linear infinite",
};

const labelStyle: React.CSSProperties = {
  margin: "0.75rem 0 0",
  fontSize: "0.85rem",
  color: "#5C6D66",
};
