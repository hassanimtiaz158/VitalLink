import Link from "next/link";

export default function HomePage() {
  return (
    <div style={wrap}>
      <header style={header}>
        <div style={logo}>VitalLink</div>
        <p style={tagline}>Connecting blood donors with those in need</p>
      </header>

      <main>
        {/* Hero */}
        <section style={heroSection}>
          <h1 style={heroTitle}>Need blood? Find a donor.</h1>
          <p style={heroSubtitle}>
            VitalLink connects people who need blood with compatible donors
            nearby. No hospitals, no middlemen — just direct, safe matching.
          </p>
          <div style={ctaRow}>
            <Link href="/request" style={{ ...ctaBtn, backgroundColor: "#C8102E" }}>
              I Need Blood
            </Link>
            <Link href="/donate" style={{ ...ctaBtn, backgroundColor: "#1B7F79" }}>
              I Can Donate
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section style={section}>
          <h2 style={sectionTitle}>How It Works</h2>
          <div style={stepsGrid}>
            <div style={stepCard}>
              <div style={stepNumber}>1</div>
              <h3 style={stepTitle}>Request</h3>
              <p style={stepDesc}>
                Post a blood request with your blood type, urgency, and location.
                We&apos;ll find compatible donors nearby.
              </p>
            </div>
            <div style={stepCard}>
              <div style={stepNumber}>2</div>
              <h3 style={stepTitle}>Match</h3>
              <p style={stepDesc}>
                Review ranked candidate donors sorted by distance.
                Accept the ones who fit your needs.
              </p>
            </div>
            <div style={stepCard}>
              <div style={stepNumber}>3</div>
              <h3 style={stepTitle}>Confirm</h3>
              <p style={stepDesc}>
                Donors confirm they can help. Once both sides agree,
                contact info is shared and you can coordinate.
              </p>
            </div>
            <div style={stepCard}>
              <div style={stepNumber}>4</div>
              <h3 style={stepTitle}>Chat</h3>
              <p style={stepDesc}>
                Use the in-app chat to arrange the donation.
                Your personal contact info stays private until you opt in.
              </p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section style={statsSection}>
          <div style={statBox}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1B7F79" }}>100+</div>
            <div style={{ fontSize: "0.85rem", color: "#5C6D66" }}>Registered Donors</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#C8102E" }}>8</div>
            <div style={{ fontSize: "0.85rem", color: "#5C6D66" }}>Blood Types</div>
          </div>
          <div style={statBox}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#C77E1B" }}>Lahore</div>
            <div style={{ fontSize: "0.85rem", color: "#5C6D66" }}>Coverage Area</div>
          </div>
        </section>

        {/* Links */}
        <section style={linksSection}>
          <Link href="/live" style={linkCard}>
            Live Dashboard
          </Link>
        </section>
      </main>

      <footer style={footer}>
        <p>Built for hackathon demo. All data is synthetic.</p>
      </footer>
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "2rem 1rem",
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};

const header: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "2rem",
};

const logo: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 700,
  color: "#1B7F79",
};

const tagline: React.CSSProperties = {
  color: "#5C6D66",
  fontSize: "1rem",
  marginTop: "0.25rem",
};

const heroSection: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem 0",
};

const heroTitle: React.CSSProperties = {
  fontSize: "1.8rem",
  fontWeight: 700,
  margin: "0 0 0.5rem",
};

const heroSubtitle: React.CSSProperties = {
  color: "#5C6D66",
  fontSize: "1rem",
  lineHeight: 1.6,
  maxWidth: 500,
  margin: "0 auto 1.5rem",
};

const ctaRow: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
  justifyContent: "center",
};

const ctaBtn: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  borderRadius: 8,
  color: "#fff",
  fontWeight: 600,
  fontSize: "0.95rem",
  textDecoration: "none",
};

const section: React.CSSProperties = {
  margin: "2rem 0",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "1.3rem",
  fontWeight: 700,
  textAlign: "center",
  marginBottom: "1rem",
};

const stepsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "1rem",
};

const stepCard: React.CSSProperties = {
  padding: "1.25rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
  textAlign: "center",
};

const stepNumber: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: "#1B7F79",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: "0.9rem",
  marginBottom: "0.5rem",
};

const stepTitle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  margin: "0 0 0.25rem",
};

const stepDesc: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#5C6D66",
  margin: 0,
  lineHeight: 1.4,
};

const statsSection: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "1rem",
  margin: "2rem 0",
};

const statBox: React.CSSProperties = {
  padding: "1.25rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
  textAlign: "center",
};

const linksSection: React.CSSProperties = {
  margin: "2rem 0",
  textAlign: "center",
};

const linkCard: React.CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 1.5rem",
  border: "1px solid #D8DFDA",
  borderRadius: 8,
  backgroundColor: "#fff",
  color: "#374151",
  fontWeight: 500,
  textDecoration: "none",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem 0 1rem",
  color: "#9CA3AF",
  fontSize: "0.8rem",
};
