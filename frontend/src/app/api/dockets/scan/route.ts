import { NextResponse } from "next/server";
import { scanAllDocketsCached } from "@/lib/genlayer";
import { serialise } from "@/lib/serialise";

export const dynamic = "force-dynamic";

/**
 * Every existing docket, for pages that must filter by address.
 *
 * The contract has no index-by-address read, so this walks sequential ids. It is expensive
 * against the rate limit, hence the 60s memo in scanAllDocketsCached — and hence it lives on the
 * server rather than in the browser.
 */
export async function GET(req: Request) {
  const requestNonce = Number(req.headers.get("x-docket-scan-nonce") ?? 0);
  try {
    const scanned = await scanAllDocketsCached(requestNonce);
    return NextResponse.json({
      dockets: scanned.map(({ id, docket }) => ({ id, docket: serialise(docket) })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? "rpc error", dockets: null },
      { status: 502 },
    );
  }
}
