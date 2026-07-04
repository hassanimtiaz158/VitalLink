/**
 * Fetch wrapper with automatic timeout and network-error handling.
 * Returns a user-friendly error message on failure.
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
