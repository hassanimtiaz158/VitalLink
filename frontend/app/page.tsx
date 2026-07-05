/**
 * Landing page — the front door of VitalLink.
 *
 * Two clear entry points:
 *   "I want to donate" → /donate (teal accent)
 *   "I need blood"     → /request-help (red accent)
 * Plus a smaller link to the hospital dashboard.
 */
import Link from "next/link";

const RED = "#C8102E";
const TEAL = "#1B7F79";

export default function Home() {
  return (
    <div style={wrap}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={brandStyle}>
          <div style={markStyle}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
              <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>VitalLink</h1>
            <p style={{ fontSize: 12.5, color: "#5C6D66", margin: "1px 0 0" }}>Real-time blood donor matching</p>
          </div>
        </div>
        <Link href="/live" style={liveLink}>
          <span style={liveDot} />
          Live dashboard
        </Link>
      </header>

      {/* Hero */}
      <section style={heroSection}>
        <p style={eyebrow}>SDG 3 — Good Health &amp; Well-being</p>
        <h2 style={heroTitle}>
          Every unit of blood<br />saves up to <span style={{ color: RED }}>3 lives</span>
        </h2>
        <p style={heroSub}>
          VitalLink connects donors with hospitals in real time. Register to donate, or request
          blood for someone in need — matched by blood type and proximity.
        </p>
      </section>

      {/* Entry points */}
      <section style={cardsStyle}>
        {/* Donor card */}
        <Link href="/donate" style={{ ...cardStyle, borderTop: `3px solid ${TEAL}` }}>
          <div style={{ ...iconCircle, backgroundColor: TEAL }}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 28, height: 28 }}>
              <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
            </svg>
          </div>
          <h3 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.5rem" }}>I want to donate</h3>
          <p style={{ color: "#5C6D66", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
            Register your blood type and location. When a hospital near you has a match, you will
            receive an email with a one-click response link.
          </p>
          <span style={{ ...ctaStyle, backgroundColor: TEAL }}>Register as a donor</span>
        </Link>

        {/* Patient card */}
        <Link href="/request-help" style={{ ...cardStyle, borderTop: `3px solid ${RED}` }}>
          <div style={{ ...iconCircle, backgroundColor: RED }}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 28, height: 28 }}>
              <path d="M11 2C11 2 4 9.5 4 14.5C4 18.09 7.13 21 11 21C14.87 21 18 18.09 18 14.5C18 9.5 11 2 11 2Z" fill="white"/>
              <circle cx="11" cy="14" r="3" fill="white" opacity="0.4"/>
            </svg>
          </div>
          <h3 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.5rem" }}>I need blood</h3>
          <p style={{ color: "#5C6D66", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
            See all active shortage requests in your area, updated in real time. Find out which
            hospitals need donors right now.
          </p>
          <span style={{ ...ctaStyle, backgroundColor: RED }}>View requests</span>
        </Link>
      </section>

      {/* Hospital login */}
      <section style={hospitalSection}>
        <Link href="/dashboard" style={hospitalLink}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18 }}>
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="#6b7280" strokeWidth="1.5" fill="none"/>
            <path d="M12 7v10M7 12h10" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Hospital dashboard
        </Link>
      </section>

      {/* Footer */}
      <footer style={footerStyle}>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#9CA3AF" }}>
          VitalLink &middot; Open source &middot; Built for SDG 3
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const wrap: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#EDF1EF",
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem 2rem",
  backgroundColor: "#fff",
  borderBottom: "1px solid #D8DFDA",
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
  backgroundColor: RED,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const liveLink: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#5C6D66",
  textDecoration: "none",
  fontSize: "0.85rem",
  fontWeight: 500,
};

const liveDot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  backgroundColor: TEAL,
  animation: "blink 1.6s infinite",
};

const heroSection: React.CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  padding: "4rem 1rem 2rem",
  textAlign: "center",
};

const eyebrow: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#5C6D66",
  margin: "0 0 1rem",
};

const heroTitle: React.CSSProperties = {
  fontSize: "2.5rem",
  fontWeight: 700,
  lineHeight: 1.15,
  margin: "0 0 1rem",
  letterSpacing: "-0.02em",
};

const heroSub: React.CSSProperties = {
  fontSize: "1.05rem",
  color: "#5C6D66",
  lineHeight: 1.6,
  margin: 0,
};

const cardsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.25rem",
  maxWidth: 720,
  margin: "0 auto",
  padding: "1.5rem 1rem 2rem",
  width: "100%",
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "2rem 1.75rem",
  backgroundColor: "#fff",
  border: "1px solid #D8DFDA",
  borderRadius: 12,
  textDecoration: "none",
  color: "inherit",
  transition: "box-shadow 0.15s",
};

const iconCircle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "1rem",
};

const ctaStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.6rem 1.25rem",
  color: "#fff",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.9rem",
  textDecoration: "none",
  alignSelf: "flex-start",
};

const hospitalSection: React.CSSProperties = {
  textAlign: "center",
  padding: "0 1rem 3rem",
};

const hospitalLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#6b7280",
  textDecoration: "none",
  fontSize: "0.85rem",
  fontWeight: 500,
  padding: "0.5rem 1rem",
  border: "1px solid #D8DFDA",
  borderRadius: 8,
  backgroundColor: "#fff",
};

const footerStyle: React.CSSProperties = {
  marginTop: "auto",
  padding: "1.5rem 2rem",
  borderTop: "1px solid #D8DFDA",
  textAlign: "center",
};
