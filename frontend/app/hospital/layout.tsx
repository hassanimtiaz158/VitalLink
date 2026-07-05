/**
 * Hospital route group layout — neutral (slate) accent.
 *
 * Wraps hospital dashboard pages with a neutral-toned header.
 * Nav is hospital-only: no donor or patient links exposed.
 * Hospital staff don't need to see "Want to donate?" or "Need blood?" —
 * those are for the public-facing flows.
 */
import Link from "next/link";

export const metadata = {
  title: "VitalLink — Hospital Dashboard",
};

export default function HospitalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#EDF1EF" }}>
      <header style={headerStyle}>
        <Link href="/" style={backLink}>&larr; Home</Link>
        <div style={brandStyle}>
          <div style={markStyle}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
              <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>VitalLink</h1>
            <p style={{ fontSize: 12.5, color: "#5C6D66", margin: "1px 0 0" }}>Hospital dashboard</p>
          </div>
        </div>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <Link href="/hospital/dashboard" style={navLink}>Dashboard</Link>
          <Link href="/hospital/requests/new" style={navLink}>New request</Link>
          <Link href="/live" style={navLink}>Live dashboard</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem 2rem",
  backgroundColor: "#fff",
  borderBottom: "1px solid #D8DFDA",
  flexWrap: "wrap",
  gap: "1rem",
};

const brandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const markStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: "#374151",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const backLink: React.CSSProperties = {
  color: "#5C6D66",
  textDecoration: "none",
  fontSize: "0.85rem",
  fontWeight: 500,
};

const navLink: React.CSSProperties = {
  color: "#374151",
  textDecoration: "none",
  fontSize: "0.85rem",
  fontWeight: 500,
};
