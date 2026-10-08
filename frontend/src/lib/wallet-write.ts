"use client";

import type { Eip1193Provider } from "./wallet";
import { network } from "./config";

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

/** Known chain ids, so the error can say something better than "wrong network". */
const KNOWN_CHAINS: Record<number, string> = {
  1: "Ethereum Mainnet",
  11155111: "Sepolia",
  8453: "Base",
  4221: "GenLayer Testnet Bradbury",
  61999: "GenLayer Studionet",
  61127: "GenLayer Localnet",
};

export class WrongNetworkError extends Error {
  constructor(readonly walletChainId: number) {
    super(
      `Your wallet is on ${KNOWN_CHAINS[walletChainId] ?? `chain ${walletChainId}`} (id ` +
        `${walletChainId}), but this app writes to ${network.label} (id ${network.chainId}). ` +
        "Switch networks in your wallet first. Signing here would send funds on the wrong chain, " +
        "where the contract address means nothing and the funds cannot be recovered.",
    );
    this.name = "WrongNetworkError";
  }
}

/**
 * Refuse to write unless the wallet is on the expected chain.
 *
 * This guard exists because of a real incident: with the wallet left on Ethereum mainnet, the app
 * asked the user to sign "send 250 ETH" to a GenLayer contract address — roughly $603,000, on a
 * chain where that address is not a contract and nothing can recover it. GEN and ETH are both
 * 18-decimal, so the number looks identical on the wrong network and nothing else warns you.
 *
 * Checked before the wallet is ever asked to sign, and again after encoding.
 */
export async function assertCorrectChain(provider: Eip1193Provider): Promise<void> {
  let chainId: number;
  try {
    const raw = await provider.request({ method: "eth_chainId" });
    chainId = typeof raw === "string" ? Number(BigInt(raw)) : Number(raw);
  } catch {
    // If the wallet will not report a chain, do not proceed.
    throw new Error(
      `Could not determine which network your wallet is on. Switch to ${network.label} manually and retry.`,
    );
  }
  if (chainId !== network.chainId) throw new WrongNetworkError(chainId);
}

/** Ask the wallet to switch to the expected chain. Returns false if it declines or lacks support. */
export async function requestChainSwitch(provider: Eip1193Provider): Promise<boolean> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${network.chainId.toString(16)}` }],
    });
    return true;
  } catch {
    return false;
  }
}

/** Native balance of an address on the wallet's current chain. */
export async function nativeBalance(
  provider: Eip1193Provider,
  address: `0x${string}`,
): Promise<bigint> {
  const raw = (await provider.request({
    method: "eth_getBalance",
    params: [address, "latest"],
  })) as string;
  return BigInt(raw ?? "0x0");
}

export async function sendContractWrite(
  provider: Eip1193Provider,
  from: `0x${string}`,
  { method, args, value = 0n }: WriteArgs,
): Promise<`0x${string}`> {
  // Before anything else: confirm the funds are about to move on the intended chain.
  await assertCorrectChain(provider);

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

  // The escrow itself must be covered, or the write will revert for a confusing reason.
  if (value > 0n) {
    const balance = await nativeBalance(provider, from);
    if (balance < value) {
      throw new Error(
        `This escrow needs ${formatGen(value)} but the account holds ${formatGen(balance)} on ` +
          `${network.label}. Fund the account before posting.`,
      );
    }
  }

  // Chain can change while the wallet prompt is open.
  await assertCorrectChain(provider);

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

const formatGen = (wei: bigint) => {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (whole === 0n) return `${frac} wei`;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr} GEN` : `${whole} GEN`;
};
