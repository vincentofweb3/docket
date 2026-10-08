/**
 * genlayer-js client access for Docket. Safe in both server and client bundles — this module
 * deliberately avoids node builtins so a client component can import it.
 *
 * Address-typed arguments must go through `asAddress` from ./address.server before reaching
 * readContract. See that module for why; it is server-only, so address-taking reads live in
 * ./reputation.ts rather than here.
 */
import { createClient } from "genlayer-js";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import * as genlayerJs from "genlayer-js";

/**
 * Shape of the SDK's calldata helpers, declared loosely because `CalldataAddress` is not exported
 * from the package root (see address.server.ts) so the real types are not reachable.
 */
type CalldataNs = {
  encode: (obj: unknown) => number[];
  makeCalldataObject: (method: string, args?: unknown[]) => unknown;
};

/** `serialize` is exported from abi.transactions, not abi.calldata — verified at runtime. */
type SerializeNs = { serialize: (data: unknown[]) => `0x${string}` };
import { CONTRACT_ADDRESS, network } from "./config";
import type { Docket } from "./docket";

type Client = ReturnType<typeof createClient>;
let cachedClient: Client | null = null;
let cachedKey: string | null = null;

/** Read-only client unless a signer is supplied. Safe to call during server render. */
export function getClient(account?: unknown): Client {
  const key = account ? "signer" : "anonymous";
  if (cachedClient && cachedKey === key) return cachedClient;
  const chain =
    network.id === "studionet"
      ? studionet
      : network.id === "testnet-bradbury"
        ? testnetBradbury
        : localnet;
  cachedClient = createClient({ chain, account: account as never });
  cachedKey = key;
  return cachedClient;
}

const toBig = (v: unknown): bigint => BigInt(v as string | number | bigint | boolean ?? 0);

export function reviveDocket(raw: unknown): Docket {
  const d = raw as Record<string, unknown>;
  return {
    client: String(d.client ?? ""),
    worker: String(d.worker ?? ""),
    sow_text: String(d.sow_text ?? ""),
    acceptance_criteria: String(d.acceptance_criteria ?? ""),
    threshold_bp: Number(d.threshold_bp ?? 0),
    amount: toBig(d.amount),
    deadline: toBig(d.deadline),
    status: Number(d.status ?? 0),
    evidence: (d.evidence ?? []) as string[],
    note: String(d.note ?? ""),
    verdict: Number(d.verdict ?? 0),
    score: Number(d.score ?? 0),
    unmet_criteria: (d.unmet_criteria ?? []) as string[],
    created_at: toBig(d.created_at),
    resolved_at: toBig(d.resolved_at),
  };
}

/**
 * Studionet rate-limits public RPC at 30 requests/minute (verified 2026-10-07: the RPC
 * responds "Rate limit exceeded: 30 requests per minute"). Blind id scans therefore have to be
 * throttled and bounded, or they fail instead of merely being slow.
 */
const RATE_LIMIT_RETRY_MS = 2500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRANSPORT_RE =
  /rate limit|too many requests|429|ETIMEDOUT|ENETUNREACH|ECONNRESET|EAI_AGAIN|fetch failed|UND_ERR/i;

/** Thrown when a docket id genuinely does not exist yet (GenVM raises KeyError). */
export class DocketNotFound extends Error {
  constructor(public readonly id: number) {
    super(`docket ${id} does not exist`);
    this.name = "DocketNotFound";
  }
}

/** Pull the leader receipt's stderr out of whatever genlayer-js threw. */
function stderrOf(err: unknown): string {
  const receipt = (err as { cause?: { data?: { receipt?: { genvm_result?: { stderr?: string } } } } })
    ?.cause?.data?.receipt;
  return String(receipt?.genvm_result?.stderr ?? "");
}

function textOf(err: unknown): string {
  const e = err as { message?: string; shortMessage?: string } | null;
  return `${e?.message ?? ""} ${e?.shortMessage ?? ""}`;
}

/**
 * Distinguish a genuinely-absent docket from a throttled or dropped request.
 *
 * This distinction matters more than it looks: a rate limit and a non-existent docket id both
 * surface as a generic RPC error. Treating the first as the second makes a throttle silently
 * report "no dockets exist" — an empty register that looks like real chain state. A missing id
 * is specifically the contract's own KeyError for an absent TreeMap entry; anything else is a
 * transport problem and must propagate so the page says "unavailable".
 */
function isGenuineMiss(err: unknown): boolean {
  return /KeyError/.test(stderrOf(err)) && !TRANSPORT_RE.test(textOf(err));
}

async function readWithRetry<T>(id: number, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (isGenuineMiss(err)) throw new DocketNotFound(id);
      if (!TRANSPORT_RE.test(textOf(err)) || i === attempts - 1) throw err;
      await sleep(RATE_LIMIT_RETRY_MS * (i + 1));
    }
  }
  throw last;
}

/** list_open_dockets() -> u32[] — one RPC call, so always the cheap source of truth. */
export async function listOpenDockets(): Promise<number[]> {
  const raw = await readWithRetry(-1, () =>
    getClient().readContract({
      address: CONTRACT_ADDRESS,
      functionName: "list_open_dockets",
    }),
  );
  return (raw as number[]).map(Number);
}

/** get_docket(docket_id: u32) -> Docket. Throws DocketNotFound if the id was never created. */
export async function getDocket(id: number): Promise<Docket> {
  const raw = await readWithRetry(id, () =>
    getClient().readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_docket",
      args: [id],
    }),
  );
  return reviveDocket(raw);
}

/**
 * Find every existing docket id, then load their records.
 *
 * Docket ids are assigned sequentially from 0, so the existing range is contiguous: 0..highest.
 * The contract has no index-by-address or "highest id" read, so `highest` has to be discovered.
 *
 * Blindly probing downward from an arbitrary ceiling is far too slow here: Studionet allows only
 * 30 RPC requests/minute, so a 20-id probe alone exceeds the budget. `list_open_dockets` is one
 * cheap call and its highest id is a valid lower bound on `highest` whenever any docket is still
 * open — which is the common case. The downward walk from there is short. Only when nothing is
 * open does it fall back to a bounded ceiling.
 */
export async function scanAllDockets(delayMs = 1200): Promise<{ id: number; docket: Docket }[]> {
  let ceiling = -1;
  try {
    const open = await listOpenDockets();
    ceiling = open.length ? Math.max(...open) : -1;
  } catch {
    // Fall back to the bounded walk below rather than reporting nothing.
    ceiling = -1;
  }

  let highest = -1;
  const start = ceiling >= 0 ? ceiling : FALLBACK_CEILING - 1;
  for (let id = start; id >= 0 && highest < 0; id--) {
    try {
      await getDocket(id);
      highest = id;
    } catch (err) {
      // Only a genuine miss lets the walk continue; a transport failure must propagate so the
      // page reports "unavailable" instead of an empty register.
      if (!(err instanceof DocketNotFound)) throw err;
    }
    if (id > 0) await sleep(delayMs);
  }
  if (highest < 0) return [];

  const ids = Array.from({ length: highest + 1 }, (_, i) => i);
  const found: { id: number; docket: Docket }[] = [];
  for (const [n, id] of ids.entries()) {
    try {
      found.push({ id, docket: await getDocket(id) });
    } catch (err) {
      if (!(err instanceof DocketNotFound)) throw err;
    }
    if (n !== ids.length - 1) await sleep(delayMs);
  }
  return found;
}

/** Ceiling used only when no docket is open, so there is no cheaper bound available. */
const FALLBACK_CEILING = 12;

/**
 * Short-lived memo for the full scan.
 *
 * The scan costs roughly one RPC call per docket, which the rate limit makes a matter of tens of
 * seconds. Serving a one-minute-stale copy keeps a page render from blocking on it while staying
 * far fresher than any cached-forever figure. In-process only: fine for a single deployment, and
 * documented as such rather than pretending to be a distributed cache.
 */
let scanCache: {
  at: number;
  nonce: number;
  value: { id: number; docket: Docket }[];
} | null = null;
const SCAN_TTL_MS = 60_000;

/**
 * Invalidate the memo from a write.
 *
 * Without this, posting a docket leaves it invisible for up to the memo's 60s lifetime, which reads
 * to the user as "my post didn't save". `nonce` lets a scan request that began before the write
 * detect that it is holding pre-write state.
 */
export function invalidateScan(nonce = 0): void {
  scanCache = null;
  lastInvalidationNonce = Math.max(lastInvalidationNonce, nonce);
}

let lastInvalidationNonce = 0;

/** Nonce of the most recent invalidation, so a stale in-flight scan can be discarded. */
export function scanInvalidationNonce(): number {
  return lastInvalidationNonce;
}

export async function scanAllDocketsCached(
  requestNonce = 0,
): Promise<{ id: number; docket: Docket }[]> {
  // A scan requested before the last invalidation is looking at pre-write state; refresh it.
  const stale = requestNonce > 0 && requestNonce < lastInvalidationNonce;
  if (!stale && scanCache && Date.now() - scanCache.at < SCAN_TTL_MS) return scanCache.value;
  const value = await scanAllDockets();
  scanCache = { at: Date.now(), nonce: requestNonce, value };
  return value;
}

/**
 * Encode a contract call the way the protocol expects it in an EVM transaction.
 *
 * A GenLayer write is not a direct call to the contract: it is an EVM transaction to the chain's
 * consensus main contract whose `data` is the RLP-serialized contract calldata. Mirrors what
 * genlayer-js does internally in `writeContract` — `[encode(makeCalldataObject(...)), leaderOnly]`
 * passed through `serialize` — so the SDK remains the single source of truth for the encoding.
 *
 * Exported because the browser cannot import genlayer-js (it is deliberately server-external), so
 * the wallet path gets its payload from /api/encode instead.
 */
export function encodeContractCall(
  functionName: string,
  args: unknown[],
  leaderOnly = false,
): string {
  const ns = genlayerJs as unknown as {
    abi?: { calldata?: CalldataNs; transactions?: SerializeNs };
    calldata?: CalldataNs;
    transactions?: SerializeNs;
  };
  const cd = ns.abi?.calldata ?? ns.calldata;
  const tx = ns.abi?.transactions ?? ns.transactions;
  if (!cd?.encode || !cd?.makeCalldataObject) {
    throw new Error("genlayer-js calldata helpers are unavailable; cannot encode a write.");
  }
  if (!tx?.serialize) {
    throw new Error("genlayer-js serialize is unavailable; cannot encode a write.");
  }
  const encoded = cd.encode(cd.makeCalldataObject(functionName, args));
  return tx.serialize([encoded, leaderOnly]);
}

export type { Client };