const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  const res = await fetch(`${API_BASE}/donors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Registration failed (${res.status})`);
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
  const res = await fetch(`${API_BASE}/hospitals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Hospital registration failed (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------
export interface RequestCreate {
  hospital_id: string;
  blood_type: string;
  units_needed: number;
  urgency: string;
}

export interface RequestResponse {
  request_id: string;
  hospital_id: string;
  blood_type: string;
  units_needed: number;
  urgency: string;
  status: string;
  created_at: string;
  matched_donors: number;
}

export async function createRequest(data: RequestCreate): Promise<RequestResponse> {
  const res = await fetch(`${API_BASE}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request creation failed (${res.status})`);
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
  matches: MatchDetail[];
}

export async function getActiveRequests(): Promise<RequestResponse[]> {
  const res = await fetch(`${API_BASE}/requests/active`);
  if (!res.ok) throw new Error(`Failed to fetch active requests (${res.status})`);
  return res.json();
}

export async function getRequestMatches(requestId: string): Promise<RequestWithMatches> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/matches`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to fetch matches (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Live dashboard types
// ---------------------------------------------------------------------------
export interface ActiveRequest {
  request_id: string;
  hospital_name: string;
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
  const res = await fetch(`${API_BASE}/requests/active`);
  if (!res.ok) throw new Error(`Failed to fetch active requests (${res.status})`);
  return res.json();
}

export async function getSupplyStats(): Promise<SupplyStat[]> {
  const res = await fetch(`${API_BASE}/requests/stats/supply`);
  if (!res.ok) throw new Error(`Failed to fetch supply stats (${res.status})`);
  return res.json();
}
