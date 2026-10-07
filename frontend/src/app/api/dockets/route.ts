import { NextResponse } from "next/server";
import { listOpenDockets } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

/**
 * Read the open docket ids from chain, server-side.
 *
 * The client never imports genlayer-js directly: browser-side RPC would hit Studionet's
 * per-IP rate limit and depends on CORS. Reads go through this route instead.
 */
export async function GET() {
  try {
    return NextResponse.json({ ids: await listOpenDockets() });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? "rpc error", ids: null },
      { status: 502 },
    );
  }
}
