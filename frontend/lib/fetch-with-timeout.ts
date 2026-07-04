/**
 * AbortController-based fetch wrapper with configurable timeout.
 *
 * Converts low-level browser errors (AbortError, TypeError) into
 * user-friendly messages suitable for display in UI error banners.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = 10000, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, { ...fetchInit, signal: controller.signal });
    return res;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        "The server took too to respond. Please check your connection and try again.",
      );
    }
    if (err instanceof TypeError && /fetch/i.test(err.message)) {
      throw new Error(
        "Could not reach the server. Make sure the backend is running and try again.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
