/**
 * EmptyState — Reusable placeholder shown when no data is available.
 *
 * Displays an optional icon, title, message, and action button.
 */
interface Props {
  icon?: string;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, message, action }: Props) {
  return (
    <div style={wrap}>
      {icon && <div style={iconStyle}>{icon}</div>}
      <h3 style={titleStyle}>{title}</h3>
      <p style={msgStyle}>{message}</p>
      {action && (
        <button onClick={action.onClick} style={btn}>
          {action.label}
        </button>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  textAlign: "center",
  padding: "2.5rem 1rem",
};

const iconStyle: React.CSSProperties = {
  fontSize: "2rem",
  marginBottom: "0.75rem",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "1rem",
  fontWeight: 600,
};

const msgStyle: React.CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "0.85rem",
  color: "#5C6D66",
  maxWidth: 320,
  marginLeft: "auto",
  marginRight: "auto",
  lineHeight: 1.5,
};

const btn: React.CSSProperties = {
  padding: "0.5rem 1.25rem",
  border: "none",
  borderRadius: 6,
  backgroundColor: "#1B7F79",
  color: "#fff",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};
