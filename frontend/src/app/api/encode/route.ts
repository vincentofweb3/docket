import { NextResponse } from "next/server";
import { studionet } from "genlayer-js/chains";
import { getClient, encodeContractCall } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

/**
 * Prepare a write for an injected wallet to sign.
 *
 * Why this exists: genlayer-js has no browser-wallet write path. Its `_sendTransaction` only
 * branches on `account.type === "local"` (a private-key account) and otherwise assumes it holds
 * a signer. So a MetaMask user cannot use `writeContract` at all, and the app previously called a
 * `genlayer_sendTransaction` method that does not exist anywhere in the protocol — the request
 * failed, and because the form redirected regardless of success, a failed post looked like a
 * successful one.
 *
 * The actual GenLayer write is an EVM transaction to the chain's consensus main contract whose
 * `data` is the RLP-serialized contract calldata. Encoding and gas estimation need the SDK but no
 * signer, so both happen here and the wallet only signs and broadcasts.
 */
export async function POST(req: Request) {
  let body: { method?: string; args?: unknown[]; value?: string; from?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { method, args, value } = body;
  if (!method || typeof method !== "string") {
    return NextResponse.json({ error: "method is required" }, { status: 400 });
  }
  if (!Array.isArray(args)) {
    return NextResponse.json({ error: "args must be an array" }, { status: 400 });
  }

  // Only the contract's own methods, so this cannot become an arbitrary encoder.
  const ALLOWED = new Set([
    "create_docket",
    "claim_docket",
    "submit_deliverable",
    "accept_deliverable",
    "dispute_deliverable",
    "refund_expired",
  ]);
  if (!ALLOWED.has(method)) {
    return NextResponse.json({ error: `method ${method} is not writable` }, { status: 400 });
  }

  try {
    const client = getClient();
    const consensusAddress = studionet.consensusMainContract?.address;
    if (!consensusAddress) {
      return NextResponse.json({ error: "chain has no consensus main contract" }, { status: 500 });
    }

    const data = encodeContractCall(method, args, false);
    const valueWei = BigInt(value ?? "0");

    // Estimate against the consensus contract. This validates the payload shape before the user
    // is asked to sign anything, so a malformed call fails here rather than in the wallet.
    let gas = 200_000n;
    try {
      gas = await client.estimateTransactionGas({
        from: (body.from as `0x${string}`) ?? undefined,
        to: consensusAddress as `0x${string}`,
        data: data as `0x${string}`,
        value: valueWei,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "The network rejected this call during gas estimation, so it would not be " +
            `accepted on-chain either: ${(err as Error)?.message ?? "unknown"}`,
        },
        { status: 400 },
      );
    }

    const nonce = body.from
      ? await client.getCurrentNonce({ address: body.from as `0x${string}` }).catch(() => null)
      : null;

    return NextResponse.json({
      to: consensusAddress,
      data,
      gas: gas.toString(),
      value: `0x${valueWei.toString(16)}`,
      chainId: studionet.id,
      nonce,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? "encoding failed" },
      { status: 400 },
    );
  }
}
