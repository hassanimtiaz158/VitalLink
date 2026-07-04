interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: Props) {
  return (
    <div style={wrap}>
      <div style={iconCircle}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>!</span>
      </div>
      <p style={msgStyle}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={btn}>
          Try Again
        </button>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "2rem 1rem",
  backgroundColor: "#FBEAEA",
  border: "1px solid #F5D0D0",
  borderRadius: 10,
};

const iconCircle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  backgroundColor: "#C8102E",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "0.75rem",
};

const msgStyle: React.CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "0.85rem",
  color: "#7A0A1D",
  maxWidth: 360,
  lineHeight: 1.5,
};

const btn: React.CSSProperties = {
  padding: "0.5rem 1.25rem",
  border: "none",
  borderRadius: 6,
  backgroundColor: "#C8102E",
  color: "#fff",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};
