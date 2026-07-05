/**
 * Patient landing page — reassuring, human-first copy for someone who needs blood.
 *
 * URL: /request-help
 * Explains what happens after submitting a request, then links to the form.
 */
import Link from "next/link";

const RED = "#C8102E";

export default function RequestHelpLandingPage() {
  return (
    <div>
      {/* Hero */}
      <section style={heroStyle}>
        <div style={iconWrap}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 32, height: 32 }}>
            <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
          </svg>
        </div>
        <h2 style={heroTitle}>We are here to help</h2>
        <p style={heroSub}>
          If you or someone you love needs blood, you are in the right place.
          We will connect you with donors who are ready to give.
        </p>
      </section>

      {/* How it works */}
      <section style={stepsSection}>
        <h3 style={sectionTitle}>What happens next</h3>
        <div style={stepsList}>
          {STEPS.map((step, i) => (
            <div key={i} style={stepRow}>
              <div style={{ ...stepDot, backgroundColor: RED }}>{i + 1}</div>
              <div>
                <h4 style={stepTitle}>{step.title}</h4>
                <p style={stepDesc}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reassurance */}
      <section style={reassuranceStyle}>
        <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "#374151" }}>
          <strong>You do not need to do this alone.</strong> Once you submit your request,
          our network of registered donors is notified immediately. Many donors respond
          within minutes. You will see every response as it comes in — in real time.
        </p>
      </section>

      {/* FAQ */}
      <section style={faqSection}>
        <h3 style={sectionTitle}>Questions you might have</h3>
        {FAQS.map((faq, i) => (
          <details key={i} style={detailsStyle}>
            <summary style={summaryStyle}>{faq.q}</summary>
            <p style={faqAnswer}>{faq.a}</p>
          </details>
        ))}
      </section>

      {/* CTA */}
      <section style={ctaSection}>
        <Link href="/request-help/new" style={{ ...ctaBtn, backgroundColor: RED }}>
          Submit a blood request
        </Link>
        <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#5C6D66", margin: "0.5rem 0 0" }}>
          Takes about a minute. No account needed.
        </p>
      </section>
    </div>
  );
}

const STEPS = [
  {
    title: "Tell us what you need",
    desc: "Enter the blood type, how many units, and how urgent it is. We also need a hospital or clinic address — not your home.",
  },
  {
    title: "Donors are notified instantly",
    desc: "Matching donors in your area get an email right away. The more urgent the request, the more donors we reach out to.",
  },
  {
    title: "You see responses live",
    desc: "Every donor who accepts or declines shows up on your status page — no refreshing needed. You can share the link with family.",
  },
  {
    title: "Go donate",
    desc: "Show up at the hospital, give blood, and know that you have made a real difference in someone's life.",
  },
];

const FAQS = [
  {
    q: "Is this really free?",
    yes: true,
    a: "Yes. VitalLink is a non-profit, open-source platform. We never charge patients or donors.",
  },
  {
    q: "What if no donors respond?",
    a: "It is rare, but if it happens, you can increase the urgency level and we will reach out to donors further away. You can also contact the hospital directly for emergency transfusions.",
  },
  {
    q: "Can I share my status page with family?",
    a: "Yes. Your status page has a private link (a unique URL). Share it with anyone who wants to follow along. No login required.",
  },
  {
    q: "Will donors know my personal information?",
    a: "No. Donors only see the blood type needed, the urgency, and the hospital name. Your name and contact details are never shared.",
  },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const heroStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "1.5rem 0 1.25rem",
};

const iconWrap: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 16,
  backgroundColor: RED,
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
  maxWidth: 440,
  marginLeft: "auto",
  marginRight: "auto",
};

const stepsSection: React.CSSProperties = {
  marginBottom: "1.5rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 700,
  margin: "0 0 1rem",
};

const stepsList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const stepRow: React.CSSProperties = {
  display: "flex",
  gap: "0.85rem",
  alignItems: "flex-start",
};

const stepDot: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.8rem",
  fontWeight: 700,
  flexShrink: 0,
  marginTop: 2,
};

const stepTitle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  margin: "0 0 0.15rem",
};

const stepDesc: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#5C6D66",
  margin: 0,
  lineHeight: 1.5,
};

const reassuranceStyle: React.CSSProperties = {
  backgroundColor: "#FFF5F5",
  border: "1px solid #F5D0D0",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  marginBottom: "1.5rem",
};

const faqSection: React.CSSProperties = {
  marginBottom: "1.5rem",
};

const detailsStyle: React.CSSProperties = {
  borderBottom: "1px solid #D8DFDA",
  padding: "0.65rem 0",
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
  textAlign: "center",
};

const ctaBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 2rem",
  color: "#fff",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.95rem",
  textDecoration: "none",
};
