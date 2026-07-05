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
  phone?: string | null;
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
  phone: string | null;
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
  accepted_at: string | null;
  confirmed_at: string | null;
  contact_shared_at: string | null;
  blood_type: string;
  units_needed: number;
  urgency: string;
  request_status: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
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
): Promise<{ status: string; request_status: string }> {
  const res = await fetchWithTimeout(
    `${API_BASE}/matches/${matchId}/respond?response=${response}`,
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
// Requester types
// ---------------------------------------------------------------------------
export interface RequesterCreate {
  name: string;
  email: string;
  phone?: string | null;
  latitude: number;
  longitude: number;
}

export interface RequesterResponse {
  requester_id: string;
  name: string;
  email: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
}

export async function registerRequester(data: RequesterCreate): Promise<RequesterResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/requesters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Requester registration failed (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------
export interface RequestCreate {
  requester_id: string;
  blood_type: string;
  units_needed: number;
  urgency: string;
}

export interface RequestResponse {
  request_id: string;
  requester_id: string;
  blood_type: string;
  units_needed: number;
  urgency: string;
  status: string;
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

// ---------------------------------------------------------------------------
// Candidate donors
// ---------------------------------------------------------------------------
export interface CandidateDonor {
  donor_id: string;
  name: string;
  blood_type: string;
  distance_km: number;
  last_donation_date: string | null;
  available: boolean;
}

export async function getCandidateDonors(requestId: string): Promise<CandidateDonor[]> {
  const res = await fetchWithTimeout(`${API_BASE}/requests/${requestId}/candidate-donors`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to fetch candidates (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Accept donor
// ---------------------------------------------------------------------------
export async function acceptDonor(
  requestId: string,
  donorId: string,
): Promise<{
  match_id: string;
  donor_id: string;
  donor_name: string;
  response: string;
  request_status: string;
}> {
  const res = await fetchWithTimeout(
    `${API_BASE}/requests/${requestId}/accept-donor/${donorId}`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to accept donor (${res.status})`));
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
  accepted_at: string | null;
  confirmed_at: string | null;
  contact_shared_at: string | null;
  donor_name?: string;
  donor_blood_type?: string;
  donor_email?: string;
  donor_phone?: string | null;
  distance_km?: number;
}

export interface RequestWithMatches extends RequestResponse {
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
// Chat messages
// ---------------------------------------------------------------------------
export interface ChatMessage {
  message_id: string;
  match_id: string;
  sender_type: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export async function getMessages(matchId: string): Promise<ChatMessage[]> {
  const res = await fetchWithTimeout(`${API_BASE}/matches/${matchId}/messages`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to fetch messages (${res.status})`));
  }
  return res.json();
}

export async function sendMessage(
  matchId: string,
  senderType: "requester" | "donor",
  senderId: string,
  body: string,
): Promise<ChatMessage> {
  const res = await fetchWithTimeout(`${API_BASE}/matches/${matchId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender_type: senderType, sender_id: senderId, body }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractError(body, `Failed to send message (${res.status})`));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Live dashboard types
// ---------------------------------------------------------------------------
export interface ActiveRequest {
  request_id: string;
  requester_name: string;
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
