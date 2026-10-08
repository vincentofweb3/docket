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
    detail: "The committee agreed. The result now sits in the appeal window before becoming final.",
    done: [TX_STATUS.PENDING, TX_STATUS.PROPOSING, TX_STATUS.COMMITTING, TX_STATUS.REVEALING],
  },
  {
    key: TX_STATUS.FINALIZED,
    label: "Finalized",
    detail: "Final and no longer appealable. The escrow movement below reflects this outcome.",
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
export async function runWrite(opts: {
  title: string;
  /** Submit the transaction. The browser does this through an injected wallet. */
  send: () => Promise<unknown>;
  onPhase: (phase: TxPhase) => void;
  /** Give up after this long. Adjudication rounds are slow but not unbounded. */
  timeoutMs?: number;
}): Promise<void> {
  const { title, send, onPhase } = opts;

  onPhase({ kind: "sending", title });

  let hash: string;
  try {
    hash = (await send()) as string;
  } catch (err) {
    const code = extractErrorCode(err);
    onPhase({
      kind: "failed",
      code,
      message: code ?? (err as Error)?.message ?? "The transaction was not accepted.",
    });
    return;
  }

  const timeoutMs = opts.timeoutMs ?? 15 * 60_000;
  const started = Date.now();
  let lastStatus: TxStatus | null = null;

  onPhase({ kind: "tracking", hash, status: TX_STATUS.PENDING, since: started });

  while (Date.now() - started < timeoutMs) {
    // Status is read server-side: the SDK never ships to the browser, and the RPC rate limit is
    // shared rather than per-visitor.
    let tx: { status?: string } | null = null;
    try {
      const res = await fetch(`/api/tx/${hash}`);
      tx = res.ok ? ((await res.json()) as { status?: string }) : null;
    } catch {
      tx = null;
    }

    const status = tx?.status as TxStatus | undefined;
    if (status && status !== lastStatus) {
      lastStatus = status;
      onPhase({ kind: "tracking", hash, status, since: started });
    }

    if (status === TX_STATUS.FINALIZED) {
      onPhase({ kind: "finalized", hash });
      return;
    }
    if (status === TX_STATUS.UNDETERMINED) {
      onPhase({
        kind: "undetermined",
        hash,
        message:
          "Validators didn't reach a majority after all leader rotations. The network will " +
          "retry adjudication with a new leader - no action is needed from you.",
      });
      return;
    }
    if (status === TX_STATUS.CANCELED) {
      onPhase({ kind: "failed", code: null, message: "The transaction was canceled." });
      return;
    }

    await sleep(3000);
  }

  onPhase({
    kind: "undetermined",
    hash,
    message:
      "Still awaiting consensus after several minutes. The transaction is live on-chain - " +
      "open it in the explorer rather than resubmitting, or you risk paying twice.",
  });
}

export const explorerTxUrl = (hash: string) => network.explorerTxUrl(hash);