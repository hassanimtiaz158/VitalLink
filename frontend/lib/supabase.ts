import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Supabase client for Realtime subscriptions.
 *
 * The client connects to the same Postgres database that Supabase manages
 * and listens for INSERT/UPDATE/DELETE events via the Realtime websocket channel.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL      — e.g. https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — public anon key from Supabase dashboard
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * Subscribe to match status changes for a specific request.
 * Calls `onChange` whenever a match row for `requestId` is inserted or updated.
 *
 * Returns an unsubscribe function to clean up the subscription.
 */
export function subscribeToMatches(
  requestId: string,
  onChange: (payload: Record<string, unknown>) => void,
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`matches:${requestId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "matches",
        filter: `request_id=eq.${requestId}`,
      },
      (payload) => {
        onChange(payload.new as Record<string, unknown>);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to new request inserts (for the live request feed).
 * Calls `onInsert` whenever a new row is inserted into `requests`.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToNewRequests(
  onInsert: (payload: Record<string, unknown>) => void,
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel("requests:live")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "requests" },
      (payload) => {
        onInsert(payload.new as Record<string, unknown>);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to new match notifications for a specific donor.
 * Calls `onInsert` whenever a new match row is created for this donor.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToDonorMatches(
  donorId: string,
  onInsert: (payload: Record<string, unknown>) => void,
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`donor-matches:${donorId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "matches",
        filter: `donor_id=eq.${donorId}`,
      },
      (payload) => {
        onInsert(payload.new as Record<string, unknown>);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to chat messages for a specific match.
 * Calls `onInsert` whenever a new message row is created for this match.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToChatMessages(
  matchId: string,
  onInsert: (payload: Record<string, unknown>) => void,
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`messages:${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        onInsert(payload.new as Record<string, unknown>);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to match response changes for a specific donor.
 * Calls `onChange` when a match row for this donor is updated (e.g. status changes).
 *
 * Returns an unsubscribe function.
 */
export function subscribeToDonorMatchUpdates(
  donorId: string,
  onChange: (payload: Record<string, unknown>) => void,
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`donor-match-updates:${donorId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matches",
        filter: `donor_id=eq.${donorId}`,
      },
      (payload) => {
        onChange(payload.new as Record<string, unknown>);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
