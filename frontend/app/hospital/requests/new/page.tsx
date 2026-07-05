/**
 * New hospital request page — submit a blood shortage request.
 *
 * Extracted from the dashboard to keep /hospital/dashboard focused on
 * overview and tracking, while /hospital/requests/new handles creation.
 * Guarded: redirects to /hospital/login if no hospital ID in sessionStorage.
 *
 * URL: /hospital/requests/new
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequestForm from "@/components/RequestForm";
import { RoleGuard } from "@/components/shared";

const DEMO_HOSPITAL_ID = process.env.NEXT_PUBLIC_DEMO_HOSPITAL_ID ?? "";

export default function NewRequestPage() {
  return (
    <RoleGuard
      storage="sessionStorage"
      key="vitallink_hospital_id"
      redirectTo="/hospital/login"
      envFallback={DEMO_HOSPITAL_ID}
    >
      <NewRequestInner />
    </RoleGuard>
  );
}

function NewRequestInner() {
  const router = useRouter();
  const [hospitalId, setHospitalId] = useState(DEMO_HOSPITAL_ID);

  // Read from sessionStorage if not set via env
  useEffect(() => {
    if (!hospitalId) {
      const stored = sessionStorage.getItem("vitallink_hospital_id");
      if (stored) setHospitalId(stored);
    }
  }, [hospitalId]);

  function handleCreated() {
    router.push("/hospital/dashboard");
  }

  return (
    <main style={mainStyle}>
      <h1 style={pageTitle}>New Shortage Request</h1>
      <p style={{ color: "#5C6D66", fontSize: "0.9rem", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
        Submit a new blood shortage request. Compatible donors within range will be notified automatically.
      </p>
      <RequestForm hospitalId={hospitalId} onRequestCreated={handleCreated} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const mainStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "2rem 1rem 4rem",
  fontFamily: "system-ui, sans-serif",
};

const pageTitle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  margin: "0 0 0.5rem",
};
