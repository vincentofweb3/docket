import { NextResponse } from "next/server";
import { getClient, encodeWriteTransaction } from "@/lib/genlayer";
import { CONTRACT_ADDRESS, network } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Prepare a write for an injected wallet to sign.
 *
 * Why this exists: genlayer-js has no browser-wallet write path. Its `_sendTransaction` only
 * branches on `account.type === "local"` (a private-key account) and otherwise assumes it holds a
 * signer. So a MetaMask user cannot use `writeContract` at all, and the app previously called a
 * `genlayer_sendTransaction` method that does not exist anywhere in the protocol — the request
 * failed, and because the form redirected regardless of success, a failed post looked like a
 * successful one.
 *
 * A GenLayer write is an EVM transaction to the chain's consensus main contract whose `data` is an
 * `addTransaction(sender, recipient, ...)` call carrying the serialized contract calldata. The
 * recipient is the deployed Docket address, so the payload names the contract it targets. Encoding
 * and gas estimation need the SDK but no signer, so both happen here and the wallet only signs and
 * broadcasts.
 */
export async function POST(req: Request) {
  let body: { method?: string; args?: unknown[]; value?: string; from?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { method, args, value, from } = body;
  if (!method || typeof method !== "string") {
    return NextResponse.json({ error: "method is required" }, { status: 400 });
  }
  if (!Array.isArray(args)) {
    return NextResponse.json({ error: "args must be an array" }, { status: 400 });
  }
  if (!from || typeof from !== "string") {
    return NextResponse.json(
      { error: "from (the connected account) is required so the transaction can name its sender" },
      { status: 400 },
    );
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
    const { to, data } = encodeWriteTransaction({
      from: from as `0x${string}`,
      functionName: method,
      args,
    });
    const valueWei = BigInt(value ?? "0");

    // Estimate against the consensus contract, which is the EVM destination of every GenLayer
    // write. This validates the payload shape before the user is asked to sign anything, so a
    // malformed call fails here rather than in the wallet.
    let gas = 200_000n;
    try {
      gas = await getClient().estimateTransactionGas({
        from: from as `0x${string}`,
        to,
        data,
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

    const nonce = await getClient()
      .getCurrentNonce({ address: from as `0x${string}` })
      .catch(() => null);

    return NextResponse.json({
      to,
      data,
      gas: gas.toString(),
      value: `0x${valueWei.toString(16)}`,
      // From config, not hardcoded: genlayer.ts picks the chain from the same config, so a
      // bradbury/localnet build would otherwise advertise Studionet's id alongside another
      // network's consensus contract.
      chainId: network.chainId,
      nonce,
      // Echoed so a caller can assert the payload targets the deployed contract.
      recipient: CONTRACT_ADDRESS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? "encoding failed" },
      { status: 400 },
    );
  }
}