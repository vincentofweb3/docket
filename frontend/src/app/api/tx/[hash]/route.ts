import { NextResponse } from "next/server";
import { getClient } from "@/lib/genlayer";
import { normaliseTxStatus } from "@/lib/tx";

export const dynamic = "force-dynamic";

/**
 * Status of a transaction, for the write-lifecycle poller.
 *
 * Polling from the browser would mean shipping genlayer-js to the client and hitting Studionet's
 * rate limit per visitor. This keeps the SDK server-side and returns only the fields the
 * lifecycle UI needs.
 *
 * `status` is normalised to its NAME here, and that is load-bearing rather than cosmetic.
 * `client.getTransaction()` returns `status` as a NUMBER (verified live on Studionet: status 7 for
 * a finalized tx) and exposes the human-readable form separately as `statusName`, which the SDK
 * itself derives via `transactionsStatusNumberToName` (genlayer-js dist/index.js:1502-1503; its own
 * code does `Number(transaction.status)` at :742 and :812).
 *
 * `tx.ts` compares this value against `TX_STATUS`, which is a set of name strings. Passing the raw
 * number through meant every comparison was false: FINALIZED, UNDETERMINED and CANCELED were all
 * unreachable, `evaluateFinalized` was dead code, and runWrite could only ever time out and report
 * failure even for a transaction that had succeeded on chain.
 *
 * `result` is passed through as a NUMBER, deliberately. `GenLayerTransaction` declares it
 * `result?: number` (dist/index-C3Ul1Rte.d.ts:190), and `evaluateFinalized` compares it against the
 * numeric `TX_RESULT` codes. Casting it to a string here would break the same way in the other
 * direction.
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
      status?: number;
      statusName?: string;
      result?: number;
    } | null;
    if (!tx) return NextResponse.json({ status: null, result: null });
    // normaliseTxStatus converts the numeric status to its name. result stays numeric.
    return NextResponse.json({
      status: normaliseTxStatus(tx),
      result: tx.result ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? "rpc error", status: null, result: null },
      { status: 502 },
    );
  }
}