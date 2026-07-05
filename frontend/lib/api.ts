/**
 * Typed API client for the VitalLink FastAPI backend.
 *
 * Every fetch goes through fetchWithTimeout for automatic timeout handling
 * and user-friendly error messages on network failures.
 */
import { fetchWithTimeout } from "./fetch-with-timeout";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

function extractError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as Record<string, unknown>).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e: any) => {
        if (typeof e === "string") return e;
        if (e?.msg) return e.msg;
        return JSON.stringify(e);
      })
      .join("; ");
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Donor types
// ---------------------------------------------------------------------------
export interface DonorCreate {
  name: string;
  blood_type: string;
  email: string;
  latitude: number;
  longitude: number;
  available: boolean;
  last_donation_date?: string | null;
}

export interface DonorResponse {
  donor_id: string;
  name: string;
  blood_type: string;
  email: string;
  latitude: number;
  longitude: number;
  available: boolean;
  last_donation_date: string | null;
  created_at: string;
}

export async function registerDonor(data: DonorCreate): Promise<DonorResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/donors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Registration failed (${res.status})`));
  }
  return res.json();
}

export async function getDonor(donorId: string): Promise<DonorResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/donors/${donorId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Donor not found (${res.status})`));
  }
  return res.json();
}

export async function listDonors(): Promise<DonorResponse[]> {
  const res = await fetchWithTimeout(`${API_BASE}/donors`, { timeoutMs: 15000 });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to fetch donors (${res.status})`));
  }
  return res.json();
}

export async function updateDonorAvailability(
  donorId: string,
  available: boolean,
): Promise<DonorResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/donors/${donorId}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to update availability (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Donor match types
// ---------------------------------------------------------------------------
export interface DonorMatchEntry {
  match_id: string;
  request_id: string;
  response: string;
  notified_at: string | null;
  blood_type: string;
  units_needed: number;
  urgency: string;
  request_status: string;
  requester_type: string;
  hospital_name: string | null;
  distance_km: number | null;
}

export interface DonorMatchesResponse {
  donor_id: string;
  name: string;
  blood_type: string;
  available: boolean;
  pending: DonorMatchEntry[];
  history: DonorMatchEntry[];
  impact: {
    total_notified: number;
    accepted: number;
    lives_potentially_saved: number;
  };
}

export async function getDonorMatches(donorId: string): Promise<DonorMatchesResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/donors/${donorId}/matches`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to fetch donor matches (${res.status})`));
  }
  return res.json();
}

export async function respondToMatch(
  matchId: string,
  response: "accepted" | "declined",
  token?: string,
): Promise<{ status: string; request_status: string }> {
  const params = new URLSearchParams({ response });
  if (token) params.set("token", token);
  const res = await fetchWithTimeout(
    `${API_BASE}/matches/${matchId}/respond?${params.toString()}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to respond (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Hospital types
// ---------------------------------------------------------------------------
export interface HospitalCreate {
  name: string;
  latitude: number;
  longitude: number;
  verified?: boolean;
}

export interface HospitalResponse {
  hospital_id: string;
  name: string;
  latitude: number;
  longitude: number;
  verified: boolean;
}

export async function registerHospital(data: HospitalCreate): Promise<HospitalResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/hospitals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Hospital registration failed (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Patient types
// ---------------------------------------------------------------------------
export interface PatientCreate {
  name: string;
  blood_type: string;
  email: string;
  latitude: number;
  longitude: number;
}

export interface PatientResponse {
  patient_id: string;
  name: string;
  blood_type: string;
  email: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export async function registerPatient(data: PatientCreate): Promise<PatientResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/requests/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Patient registration failed (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------
export interface RequestCreate {
  hospital_id?: string | null;
  patient_id?: string | null;
  blood_type: string;
  units_needed: number;
  urgency: string;
}

export interface RequestResponse {
  request_id: string;
  requester_type: string;
  hospital_id: string | null;
  patient_id: string | null;
  blood_type: string;
  units_needed: number;
  urgency: string;
  status: string;
  verified_by_hospital: boolean;
  verification_code: string | null;
  created_at: string;
  matched_donors: number;
}

export async function createRequest(data: RequestCreate): Promise<RequestResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Request failed (${res.status})`));
  }
  return res.json();
}

export async function verifyRequest(
  requestId: string,
  code: string,
): Promise<{ request_id: string; verified: boolean; matched_donors: number }> {
  const res = await fetchWithTimeout(`${API_BASE}/requests/${requestId}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Verification failed (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Match types
// ---------------------------------------------------------------------------
export interface MatchDetail {
  match_id: string;
  request_id: string;
  donor_id: string;
  response: string;
  notified_at: string | null;
  donor_name?: string;
  donor_blood_type?: string;
  distance_km?: number;
}

export interface RequestWithMatches extends RequestResponse {
  verification_code: string | null;
  matches: MatchDetail[];
}

export async function getRequestMatches(requestId: string): Promise<RequestWithMatches> {
  const res = await fetchWithTimeout(`${API_BASE}/requests/${requestId}/matches`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to fetch matches (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Live dashboard types
// ---------------------------------------------------------------------------
export interface ActiveRequest {
  request_id: string;
  requester_type: string;
  source_name: string;
  blood_type: string;
  units_needed: number;
  urgency: string;
  status: string;
  created_at: string;
  latitude: number;
  longitude: number;
  match_count: number;
  accepted_count: number;
}

export interface SupplyStat {
  blood_type: string;
  available: number;
  total: number;
  pct: number;
  tag: "critical" | "low" | "ok";
  label: string;
}

export async function getActiveRequestsFeed(): Promise<ActiveRequest[]> {
  const res = await fetchWithTimeout(`${API_BASE}/requests/active`);
  if (!res.ok) throw new Error(`Failed to fetch active requests (${res.status})`);
  return res.json();
}

export async function getSupplyStats(): Promise<SupplyStat[]> {
  const res = await fetchWithTimeout(`${API_BASE}/requests/stats/supply`);
  if (!res.ok) throw new Error(`Failed to fetch supply stats (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Request status update
// ---------------------------------------------------------------------------
export async function updateRequestStatus(
  requestId: string,
  status: "fulfilled" | "closed",
): Promise<{ request_id: string; status: string }> {
  const res = await fetchWithTimeout(
    `${API_BASE}/requests/${requestId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to update status (${res.status})`));
  }
  return res.json();
}
