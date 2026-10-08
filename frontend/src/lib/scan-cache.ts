/**
 * Cross-component invalidation for the docket scan cache.
 *
 * The scan that backs My Dockets, the landing stats and the reputation index is memoised for 60s
 * because a full scan costs roughly one RPC call per docket against Studionet's 30-per-minute
 * limit. That memo lives in a server module, so after a write the client asks the server to drop
 * it — otherwise a freshly posted docket is invisible for up to a minute, which reads as "my post
 * didn't save".
 *
 * The nonce is bumped on every write and echoed by the invalidate endpoint, so a later scan request
 * that started before the write can detect it is stale and refresh.
 */

declare global {
  interface Window {
    __docketScanNonce?: number;
  }
}

const NONCE_HEADER = "x-docket-scan-nonce";

/** Ask the server to drop the memoised scan. Fire-and-forget; safe to call repeatedly. */
export async function invalidateDocketScan(): Promise<void> {
  try {
    window.__docketScanNonce = (window.__docketScanNonce ?? 0) + 1;
    await fetch(`/api/dockets/scan/invalidate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nonce: window.__docketScanNonce }),
      cache: "no-store",
    });
  } catch {
    // A failed invalidation only costs freshness; the memo expires on its own in 60s.
  }
}

/** Send the client's write counter so the server can detect a scan that predates a write. */
export function scanNonceHeaders(): Record<string, string> {
  return { [NONCE_HEADER]: String(window.__docketScanNonce ?? 0) };
}
