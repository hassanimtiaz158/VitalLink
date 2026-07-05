/**
 * RoleGuard — lightweight client-side redirect guard.
 *
 * Checks localStorage or sessionStorage for an expected ID. If missing,
 * redirects to the specified fallback route. Renders a loading spinner
 * while checking to avoid flash-of-wrong-content.
 *
 * Usage:
 *   <RoleGuard storage="localStorage" key="vitallink_donor_id" redirectTo="/donate">
 *     <DonorDashboard />
 *   </RoleGuard>
 */
"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Props {
  /** Which storage API to check */
  storage: "localStorage" | "sessionStorage";
  /** The key to look up */
  key: string;
  /** Where to redirect if the key is missing or empty */
  redirectTo: string;
  /** Optional fallback value from env (e.g. NEXT_PUBLIC_DEMO_HOSPITAL_ID).
   *  If set, the guard passes even when storage has no value. */
  envFallback?: string;
  children: ReactNode;
}

export default function RoleGuard({ storage, key, redirectTo, envFallback, children }: Props) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const store = storage === "localStorage" ? localStorage : sessionStorage;
    const value = store.getItem(key);
    if (value || envFallback) {
      setAllowed(true);
    } else {
      router.replace(redirectTo);
    }
  }, [storage, key, redirectTo, envFallback, router]);

  // Still checking
  if (allowed === null) {
    return <LoadingSpinner label="Loading\u2026" />;
  }

  return <>{children}</>;
}
