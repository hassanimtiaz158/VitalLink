/**
 * Donor route group layout — teal accent.
 *
 * Wraps the donor registration flow with a teal-accented header
 * and navigation back to the landing page. Nav is donor-only:
 * no patient or requester links exposed.
 */
import Link from "next/link";

const TEAL = "#1B7F79";

export const metadata = {
  title: "VitalLink — Donate",
};

export default function DonorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#EDF1EF" }}>
      <header style={headerStyle}>
        <Link href="/" style={backLink}>&larr; Home</Link>
        <div style={brandStyle}>
          <div style={{ ...markStyle, backgroundColor: TEAL }}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
              <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>VitalLink</h1>
            <p style={{ fontSize: 12.5, color: "#5C6D66", margin: "1px 0 0" }}>Donor registration</p>
          </div>
        </div>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <Link href="/donate" style={navLink}>Register</Link>
          <Link href="/donate/dashboard" style={navLink}>Dashboard</Link>
          <Link href="/live" style={navLink}>Live dashboard</Link>
        </nav>
      </header>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem 4rem" }}>
        {children}
      </div>
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
