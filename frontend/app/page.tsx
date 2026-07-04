import Link from "next/link";
import DonorForm from "@/components/DonorForm";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <nav style={navStyle}>
        <span style={logoStyle}>VitalLink</span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <Link href="/" style={linkStyle}>Donor Registration</Link>
          <Link href="/dashboard" style={linkStyle}>Hospital Dashboard</Link>
          <Link href="/live" style={linkStyle}>Live Dashboard</Link>
        </div>
      </nav>
      <DonorForm />
    </main>
  );
}

const navStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem 2rem",
  backgroundColor: "#fff",
  borderBottom: "1px solid #e5e7eb",
};

const logoStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  color: "#dc2626",
};

const linkStyle: React.CSSProperties = {
  color: "#374151",
  textDecoration: "none",
  fontSize: "0.9rem",
  fontWeight: 500,
};
