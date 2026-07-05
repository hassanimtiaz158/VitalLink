/**
 * Donor landing page — explains the process and CTAs.
 *
 * URL: /donate
 * Shows how the donor flow works, then links to register or dashboard.
 * "View my dashboard" checks localStorage first — routes to register if no ID.
 */
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const TEAL = "#1B7F79";

export default function DonateLandingPage() {
  const [hasId, setHasId] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("vitallink_donor_id");
    setHasId(!!id && id.trim().length > 0);
  }, []);

  return (
    <div>
      {/* Hero */}
      <section style={heroStyle}>
        <div style={iconWrap}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 32, height: 32 }}>
            <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
          </svg>
        </div>
        <h2 style={heroTitle}>Donate blood. Save lives.</h2>
        <p style={heroSub}>
          Every donation can save up to 3 people. Register once, and we will notify you
          when a hospital near you has a matching shortage.
        </p>
      </section>

      {/* Steps */}
      <section style={stepsSection}>
        <h3 style={sectionTitle}>How it works</h3>
        <div style={stepsGrid}>
          {STEPS.map((step, i) => (
            <div key={i} style={stepCard}>
              <div style={{ ...stepNumber, backgroundColor: TEAL }}>{i + 1}</div>
              <h4 style={stepTitle}>{step.title}</h4>
              <p style={stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={faqSection}>
        <h3 style={sectionTitle}>Common questions</h3>
        {FAQS.map((faq, i) => (
          <details key={i} style={detailsStyle}>
            <summary style={summaryStyle}>{faq.q}</summary>
            <p style={faqAnswer}>{faq.a}</p>
          </details>
        ))}
      </section>

      {/* CTAs */}
      <section style={ctaSection}>
        <Link href="/donate/register" style={{ ...ctaBtn, backgroundColor: TEAL }}>
          Register as a donor
        </Link>
        {hasId ? (
          <button onClick={() => { window.location.href = "/donate/dashboard"; }} style={secondaryBtn}>
            View my dashboard
          </button>
        ) : (
          <Link href="/donate/register" style={secondaryBtn}>
            View my dashboard
          </Link>
        )}
        <p style={{ fontSize: "0.75rem", color: "#9CA3AF", textAlign: "center", margin: "0.25rem 0 0" }}>
          {hasId
            ? "You are registered — your dashboard shows match requests and impact."
            : "Not registered yet? You will be taken to registration."}
        </p>
      </section>
    </div>
  );
}

const STEPS = [
  {
    title: "Register",
    desc: "Enter your name, blood type, and location. Takes less than a minute.",
  },
  {
    title: "Get matched",
    desc: "When a hospital near you needs your blood type, we send you an email with one click.",
  },
  {
    title: "Respond",
    desc: "Click 'I can help' if you can donate, or 'Not right now' if you cannot.",
  },
  {
    title: "Save lives",
    desc: "Show up at the hospital, donate, and your impact is tracked in your dashboard.",
  },
];

const FAQS = [
  {
    q: "Is my data private?",
    a: "Your name and email are only used to notify you about donation opportunities. Your location is approximate — we never share your exact address publicly.",
  },
  {
    q: "How often will I be contacted?",
    a: "Only when a hospital within your radius has an urgent need for your blood type. We do not spam — typically a few times per month at most.",
  },
  {
    q: "Can I pause notifications?",
    a: "Yes. Toggle your availability off in the dashboard anytime. You will stop receiving notifications until you turn it back on.",
  },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const heroStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem 0 1.5rem",
};

const iconWrap: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 16,
  backgroundColor: TEAL,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 1rem",
};

const heroTitle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  margin: "0 0 0.5rem",
};

const heroSub: React.CSSProperties = {
  color: "#5C6D66",
  lineHeight: 1.6,
  margin: 0,
  maxWidth: 480,
  marginLeft: "auto",
  marginRight: "auto",
};

const stepsSection: React.CSSProperties = {
  marginBottom: "2rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "1.15rem",
  fontWeight: 700,
  margin: "0 0 1rem",
};

const stepsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "0.75rem",
};

const stepCard: React.CSSProperties = {
  padding: "1.25rem",
  border: "1px solid #D8DFDA",
  borderRadius: 10,
  backgroundColor: "#fff",
};

const stepNumber: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.8rem",
  fontWeight: 700,
  marginBottom: "0.5rem",
};

const stepTitle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  margin: "0 0 0.25rem",
};

const stepDesc: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#5C6D66",
  margin: 0,
  lineHeight: 1.5,
};

const faqSection: React.CSSProperties = {
  marginBottom: "2rem",
};

const detailsStyle: React.CSSProperties = {
  borderBottom: "1px solid #D8DFDA",
  padding: "0.75rem 0",
};

const summaryStyle: React.CSSProperties = {
  fontWeight: 500,
  fontSize: "0.9rem",
  cursor: "pointer",
};

const faqAnswer: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#5C6D66",
  margin: "0.5rem 0 0",
  lineHeight: 1.5,
};

const ctaSection: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const ctaBtn: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "0.75rem",
  color: "#fff",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.95rem",
  textDecoration: "none",
};

const secondaryBtn: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "0.75rem",
  color: TEAL,
  border: `1px solid ${TEAL}`,
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.9rem",
  textDecoration: "none",
};
