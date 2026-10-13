/**
 * Write transactions and their lifecycle tracking.
 *
 * Per docs/06-integration-plan.md and design/components.html, a write must surface the real
 * GenLayer lifecycle — submitted → pending → proposing/committing/revealing → accepted →
 * finalized — plus a distinct failed and undetermined outcome. Never collapse it into a
 * spinner: `dispute_deliverable` can sit in adjudication for a full Optimistic Democracy
 * round, and the person waiting needs to know that is normal.
 */

import { network } from "./config";
import { extractErrorCode } from "./docket";

/** GenLayer transaction statuses, from the protocol's state machine. */
export const TX_STATUS = {
  UNINITIALIZED: "UNINITIALIZED",
  PENDING: "PENDING",
  PROPOSING: "PROPOSING",
  COMMITTING: "COMMITTING",
  REVEALING: "REVEALING",
  ACCEPTED: "ACCEPTED",
  UNDETERMINED: "UNDETERMINED",
  FINALIZED: "FINALIZED",
  CANCELED: "CANCELED",
  APPEAL_REVEALING: "APPEAL_REVEALING",
  APPEAL_COMMITTING: "APPEAL_COMMITTING",
  READY_TO_FINALIZE: "READY_TO_FINALIZE",
  VALIDATORS_TIMEOUT: "VALIDATORS_TIMEOUT",
  LEADER_TIMEOUT: "LEADER_TIMEOUT",
} as const;

export type TxStatus = (typeof TX_STATUS)[keyof typeof TX_STATUS];

/**
 * Transaction result codes, from the protocol's own `TransactionResult` enum
 * (genlayer-js `transactionResultNumberToName`, chunk-EY35NPSE.js).
 *
 * These are consensus outcomes, distinct from {@link TX_STATUS}. A transaction can be FINALIZED and
 * still have failed: the network reached finality on a transaction whose contract execution did not
 * succeed.
 */
export const TX_RESULT = {
  IDLE: 0,
  AGREE: 1,
  DISAGREE: 2,
  TIMEOUT: 3,
  DETERMINISTIC_VIOLATION: 4,
  /** Execution did not reach a majority, so the call did not take effect. */
  NO_MAJORITY: 5,
  MAJORITY_AGREE: 6,
  MAJORITY_DISAGREE: 7,
} as const;

export type TxResultCode = (typeof TX_RESULT)[keyof typeof TX_RESULT];

/** Result codes where the contract call actually took effect. */
const SUCCEEDED_RESULTS: ReadonlySet<number> = new Set([
  TX_RESULT.AGREE,
  TX_RESULT.DISAGREE,
  TX_RESULT.MAJORITY_AGREE,
  TX_RESULT.MAJORITY_DISAGREE,
]);

/** Human-readable reasons for the codes that mean the call did not take effect. */
const RESULT_REASON: Record<number, string> = {
  [TX_RESULT.NO_MAJORITY]:
    "the transaction finalized without a majority, so the contract call did not take effect",
  [TX_RESULT.TIMEOUT]: "validators timed out on this transaction, so it did not take effect",
  [TX_RESULT.DETERMINISTIC_VIOLATION]:
    "the transaction violated deterministic rules and was rejected",
};

/**
 * The wire shape `/api/tx/[hash]` returns.
 *
 * `status` is a NAME because that is what this module compares against; `result` is a NUMBER
 * because {@link evaluateFinalized} compares against numeric codes. Both are load-bearing — see
 * normaliseTxStatus for why the status has to be converted rather than passed through.
 */
export type TxWire = { status: string | null; result: number | null };

/**
 * Convert a GenLayer transaction's `status` to its name, the form this module compares against.
 *
 * `client.getTransaction()` returns `status` as a NUMBER — verified live on Studionet, where a
 * finalized transaction reports `status: 7` — and exposes the readable form separately as
 * `statusName`, which the SDK derives itself via `transactionsStatusNumberToName`
 * (genlayer-js dist/index.js:1502-1503). Its own code does `Number(transaction.status)`
 * (dist/index.js:742 and :812).
 *
 * This exists as a shared, testable function rather than inline logic in the route handler because
 * getting it wrong is silent and total: a number reaching `status === TX_STATUS.FINALIZED` makes
 * every comparison false, so a write that succeeded on chain is reported to the user as a
 * 15-minute timeout. That bug shipped once already, and a test that stubbed the convenient string
 * shape rather than the real wire shape could not see it.
 *
 * `statusName` is preferred because it is authoritative, including on Localnet where the SDK
 * rewrites the name (dist/index.js:1316-1319). The numeric fallback exists for a response that
 * carries `status` without `statusName`.
 */
export function normaliseTxStatus(tx: {
  status?: number | string | null;
  statusName?: string | null;
}): TxStatus | null {
  const name =
    typeof tx.statusName === "string" && tx.statusName.length > 0
      ? tx.statusName
      : typeof tx.status === "string"
        ? tx.status
        : typeof tx.status === "number"
          ? TX_STATUS_NUMBER_TO_NAME[tx.status]
          : undefined;
  if (name === undefined) return null;
  // Unknown names (a future protocol status, or Localnet's ACTIVATED) are passed through as-is:
  // callers treat them as "not terminal" and keep polling, which is the safe failure mode. The
  // cast is deliberate and bounded — it is not hiding a number/string mismatch, since both
  // branches above have already produced a string.
  return name as TxStatus;
}

/** Protocol status number to name, from genlayer-js `transactionsStatusNumberToName`. */
export const TX_STATUS_NUMBER_TO_NAME: Record<number, TxStatus> = {
  0: "UNINITIALIZED",
  1: "PENDING",
  2: "PROPOSING",
  3: "COMMITTING",
  4: "REVEALING",
  5: "ACCEPTED",
  6: "UNDETERMINED",
  7: "FINALIZED",
  8: "CANCELED",
  9: "APPEAL_REVEALING",
  10: "APPEAL_COMMITTING",
  11: "READY_TO_FINALIZE",
  12: "VALIDATORS_TIMEOUT",
  13: "LEADER_TIMEOUT",
};

/**
 * Whether a FINALIZED transaction actually executed its contract call.
 *
 * `status === FINALIZED` alone is not success. FINALIZED is a statement about finality, not about
 * the call succeeding: this repo already documents a payout child tx
 * (0xa919c47c6872ed1c778cc1752e1c3cd2078d348bb0702cb0a05c6efc50fdde1d) that reached status 7
 * FINALIZED with result 5 NO_MAJORITY — and reading only `status` reported that as a success.
 *
 * Gas estimation cannot catch this class of failure either: /api/encode estimates against the
 * CONSENSUS main contract (genlayer.ts), not against Docket, so a Docket-level revert such as
 * EXPECTED_ZERO_VALUE passes estimation and fails at execution. The receipt is the only place the
 * real outcome is knowable, so it is checked here.
 *
 * Returns null when the result has not been reported yet, which is not a failure and not a success.
 */
export function evaluateFinalized(result: number | null | undefined): {
  ok: boolean;
  reason: string | null;
} {
  if (result === null || result === undefined) {
    return { ok: false, reason: null };
  }
  if (SUCCEEDED_RESULTS.has(result)) return { ok: true, reason: null };
  return {
    ok: false,
    reason:
      RESULT_REASON[result] ??
      `the transaction finalized with result code ${result}, so the contract call did not take effect`,
  };
}

/**
 * Human-facing lifecycle stages, mapped from the protocol statuses. `detail` is what the
 * person should be told is happening right now.
 */
export const LIFECYCLE_STAGES: {
  key: TxStatus | "SUBMITTED";
  label: string;
  detail: string;
  done: TxStatus[];
}[] = [
  { key: "SUBMITTED", label: "Submitted to network", detail: "Signed and sent to the GenLayer network.", done: [] },
  { key: TX_STATUS.PENDING, label: "Pending", detail: "Queued for the next block.", done: [] },
  {
    key: TX_STATUS.PROPOSING,
    label: "Proposing & committing",
    detail: "A leader has proposed a result and the committee is committing votes.",
    done: [],
  },
  {
    key: TX_STATUS.REVEALING,
    label: "Revealing",
    detail: "Validators are revealing their votes and comparing against the proposal.",
    done: [],
  },
  {
    key: TX_STATUS.ACCEPTED,
    label: "Accepted",
    // Appeal-window copy is conditional: Studionet exposes no appeal RPCs at all, so promising a
    // window there would describe a capability the network does not have.
    detail:
      network.appealSupport === "absent"
        ? "The committee agreed. The network will now finalize this result."
        : "The committee agreed. The result now sits in the appeal window before becoming final.",
    done: [TX_STATUS.PENDING, TX_STATUS.PROPOSING, TX_STATUS.COMMITTING, TX_STATUS.REVEALING],
  },
  {
    key: TX_STATUS.FINALIZED,
    label: "Finalized",
    detail:
      network.appealSupport === "absent"
        ? "Final. The escrow movement below reflects this outcome."
        : "Final and no longer appealable. The escrow movement below reflects this outcome.",
    done: [
      TX_STATUS.PENDING,
      TX_STATUS.PROPOSING,
      TX_STATUS.COMMITTING,
      TX_STATUS.REVEALING,
      TX_STATUS.ACCEPTED,
      TX_STATUS.READY_TO_FINALIZE,
    ],
  },
];

export type TxPhase =
  | { kind: "idle" }
  | { kind: "sending"; title: string }
  | { kind: "tracking"; hash: string; status: TxStatus; since: number }
  | { kind: "finalized"; hash: string }
  | { kind: "failed"; code: string | null; message: string }
  | { kind: "undetermined"; hash: string; message: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusNameOf(tx: unknown): TxStatus {
  const t = tx as { status?: string | number; statusName?: string };
  const s = t?.status ?? t?.statusName ?? "UNINITIALIZED";
  return (typeof s === "string" ? s : String(s)) as TxStatus;
}

/**
 * Send a write and poll it to a terminal state, reporting each transition through `onPhase`.
 *
 * Polling rather than a single wait is deliberate: the design calls for the real stages to be
 * visible, and a disputed adjudication legitimately takes minutes. `waitForTransactionReceipt`
 * would hide all of it behind one spinner.
 */
export type WriteOutcome =
  | { ok: true; hash: string }
  | { ok: false; hash: string | null; reason: string; code: string | null };

export async function runWrite(opts: {
  title: string;
  /** Submit the transaction. The browser does this through an injected wallet. */
  send: () => Promise<unknown>;
  onPhase: (phase: TxPhase) => void;
  /** Give up after this long. Adjudication rounds are slow but not unbounded. */
  timeoutMs?: number;
}): Promise<WriteOutcome> {
  const { title, send, onPhase } = opts;

  onPhase({ kind: "sending", title });

  let hash: string;
  try {
    hash = (await send()) as string;
  } catch (err) {
    const code = extractErrorCode(err);
    const message = (err as Error)?.message ?? "The transaction was not accepted.";
    onPhase({ kind: "failed", code, message: code ?? message });
    return { ok: false, hash: null, reason: message, code };
  }

  const timeoutMs = opts.timeoutMs ?? 15 * 60_000;
  const started = Date.now();
  let lastStatus: TxStatus | null = null;

  onPhase({ kind: "tracking", hash, status: TX_STATUS.PENDING, since: started });

  while (Date.now() - started < timeoutMs) {
    // Status is read server-side: the SDK never ships to the browser, and the RPC rate limit is
    // shared rather than per-visitor. `result` is read alongside `status` because FINALIZED alone
    // does not mean the contract call succeeded — see evaluateFinalized.
    let tx: TxWire | null = null;
    try {
      const res = await fetch(`/api/tx/${hash}`);
      tx = res.ok ? ((await res.json()) as TxWire) : null;
    } catch {
      tx = null;
    }

    // The endpoint normalises status to a name; normaliseTxStatus is applied again here as a
    // defensive measure so a number can never reach a `status === TX_STATUS.X` comparison even if
    // the route regresses. This exact mismatch shipped once and silently broke every write path.
    const status = tx?.status ? normaliseTxStatus({ status: tx.status }) : null;
    if (status && status !== lastStatus) {
      lastStatus = status;
      onPhase({ kind: "tracking", hash, status, since: started });
    }

    if (status === TX_STATUS.FINALIZED) {
      // Finality is not success. Only report ok:true when the consensus result shows the contract
      // call actually executed; otherwise surface the failure and the real reason, so the caller
      // does not invalidate its scan cache or navigate away as though a docket had been written.
      const outcome = evaluateFinalized(tx?.result);
      if (!outcome.ok) {
        const message = outcome.reason
          ? `The transaction was finalized but failed: ${outcome.reason}.`
          : "The transaction was finalized but the network reported no result, so it cannot be " +
            "confirmed as having taken effect.";
        onPhase({ kind: "failed", code: null, message });
        return { ok: false, hash, reason: message, code: null };
      }
      onPhase({ kind: "finalized", hash });
      return { ok: true, hash };
    }
    if (status === TX_STATUS.UNDETERMINED) {
      onPhase({
        kind: "undetermined",
        hash,
        message:
          "Validators didn't reach a majority after all leader rotations. The network will " +
          "retry adjudication with a new leader - no action is needed from you.",
      });
      return { ok: false, hash, reason: "Adjudication is undetermined.", code: null };
    }
    if (status === TX_STATUS.CANCELED) {
      onPhase({ kind: "failed", code: null, message: "The transaction was canceled." });
      return { ok: false, hash, reason: "The transaction was canceled.", code: null };
    }

    await sleep(3000);
  }

  const timeoutMessage =
    "Still awaiting consensus after several minutes. The transaction is live on-chain - " +
    "open it in the explorer rather than resubmitting, or you risk paying twice.";
  onPhase({ kind: "undetermined", hash, message: timeoutMessage });
  return { ok: false, hash, reason: timeoutMessage, code: null };
}

export const explorerTxUrl = (hash: string) => network.explorerTxUrl(hash);