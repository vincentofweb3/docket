import { NextResponse } from "next/server";
import { getClient } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

/**
 * Status of a transaction, for the write-lifecycle poller.
 *
 * Polling from the browser would mean shipping genlayer-js to the client and hitting Studionet's
 * rate limit per visitor. This keeps the SDK server-side and returns only the fields the
 * lifecycle UI needs.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return NextResponse.json({ error: "bad hash" }, { status: 400 });
  }
  try {
    const client = getClient();
    // The SDK narrows a hash to a 66-char template literal type; the regex above already proved
    // the length, so satisfy the type explicitly rather than widening the SDK's signature.
    type Hash = `0x${string}`;
    const typedHash = hash as Hash;
    const tx = (await client.getTransaction({ hash: typedHash as never })) as {
      status?: string;
      result?: string;
    } | null;
    if (!tx) return NextResponse.json({ status: null });
    return NextResponse.json({ status: tx.status ?? null, result: tx.result ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? "rpc error", status: null },
      { status: 502 },
    );
  }
}
