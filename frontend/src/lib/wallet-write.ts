"use client";

import type { Eip1193Provider } from "./wallet";

/**
 * Submit a GenLayer write through an injected wallet.
 *
 * Why this is hand-rolled: genlayer-js has no browser-wallet write path. Its internal
 * `_sendTransaction` only branches on `account.type === "local"` (a private-key account), so a
 * MetaMask user cannot use `writeContract`. The app previously called a `genlayer_sendTransaction`
 * method that does not exist in the protocol — the request failed, and because the form
 * redirected regardless of outcome, a failed post looked successful.
 *
 * A GenLayer write is an EVM transaction to the chain's consensus main contract whose `data` is
 * the RLP-serialized contract calldata. Encoding and gas estimation need the SDK but no signer, so
 * /api/encode prepares the payload and this only signs and broadcasts it. Nonce, gas price and
 * transaction type are left to the wallet.
 */
export type WriteArgs = {
  method: string;
  args: unknown[];
  value?: bigint;
};

export async function sendContractWrite(
  provider: Eip1193Provider,
  from: `0x${string}`,
  { method, args, value = 0n }: WriteArgs,
): Promise<`0x${string}`> {
  const res = await fetch("/api/encode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      method,
      args: args.map((a) => (typeof a === "bigint" ? a.toString() : a)),
      value: value.toString(),
      from,
    }),
  });

  const payload = (await res.json()) as {
    to?: string;
    data?: string;
    gas?: string;
    error?: string;
  };
  if (!res.ok || !payload.to || !payload.data) {
    throw new Error(payload.error ?? "Could not prepare this transaction.");
  }

  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: payload.to,
        data: payload.data,
        value: `0x${value.toString(16)}`,
        gas: payload.gas,
      },
    ],
  })) as `0x${string}`;

  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error(
      `The wallet did not return a transaction hash (got ${JSON.stringify(hash)}). ` +
        "On GenLayer this usually means the wallet is not connected to the GenLayer network.",
    );
  }
  return hash;
}
