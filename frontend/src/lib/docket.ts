/**
 * Docket domain types and presentation mappings.
 *
 * The numeric status/verdict values mirror contracts/docket.py exactly. They are duplicated
 * here as literals on purpose: importing the Python contract into the client build would be a
 * worse coupling than an explicit, reviewable mapping. `tests/contract-parity.test.ts` fails
 * if the two ever drift.
 */

/** From contracts/docket.py STATUS_*. */
export const STATUS = {
  OPEN: 0,
  CLAIMED: 1,
  SUBMITTED: 2,
  ADJUDICATING: 3,
  RESOLVED: 4,
  CLOSED: 5,
  EXPIRED: 6,
  ACCEPTED_FAST_PATH: 7,
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

export const STATUS_LABEL: Record<number, string> = {
  [STATUS.OPEN]: "Open",
  [STATUS.CLAIMED]: "Claimed",
  [STATUS.SUBMITTED]: "Submitted",
  [STATUS.ADJUDICATING]: "Adjudicating",
  [STATUS.RESOLVED]: "Resolved",
  [STATUS.CLOSED]: "Closed",
  [STATUS.EXPIRED]: "Expired",
  [STATUS.ACCEPTED_FAST_PATH]: "Accepted",
};

/** From contracts/docket.py VERDICT_*. */
export const VERDICT = {
  NONE: 0,
  FULL: 1,
  PARTIAL: 2,
  REJECT: 3,
} as const;

export type Verdict = (typeof VERDICT)[keyof typeof VERDICT];

export const VERDICT_LABEL: Record<number, string> = {
  [VERDICT.NONE]: "Undecided",
  [VERDICT.FULL]: "Full",
  [VERDICT.PARTIAL]: "Partial",
  [VERDICT.REJECT]: "Reject",
};

/** A docket record, matching the `Docket` storage dataclass. */
export type Docket = {
  client: string;
  worker: string;
  sow_text: string;
  acceptance_criteria: string;
  threshold_bp: number;
  amount: bigint;
  deadline: bigint;
  status: number;
  evidence: string[];
  note: string;
  verdict: number;
  score: number;
  unmet_criteria: string[];
  created_at: bigint;
  resolved_at: bigint;
};

/** A reputation record, matching the `ReputationRecord` storage dataclass. */
export type Reputation = {
  completed: number;
  disputed: number;
  upheld: number;
  score_sum: bigint;
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const docketRef = (id: number | bigint) => `DKT-${String(id).padStart(4, "0")}`;

export const shortAddress = (addr: string, lead = 6, tail = 4) =>
  !addr || addr === ZERO_ADDRESS ? "—" : `${addr.slice(0, lead)}…${addr.slice(-tail)}`;

export const formatGen = (wei: bigint | number | string | null | undefined) => {
  const v = typeof wei === "bigint" ? wei : BigInt(wei ?? 0);
  const whole = v / 10n ** 18n;
  const frac = v % 10n ** 18n;
  if (whole === 0n && frac === 0n) return "0 GEN";
  // Sub-GEN escrow is legal but looks like a rendering bug if shown as a 12-digit fraction,
  // so label the raw value explicitly instead.
  if (whole === 0n) return `${frac} wei`;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr} GEN` : `${whole} GEN`;
};

/** GEN amount as a bigint, for a value entered in whole GEN by a person. */
export const genToWei = (gen: number | string): bigint => {
  const [whole, frac = ""] = String(gen).split(".");
  const padded = (frac + "000000000000000000").slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(padded || "0");
};

const UNITS: [bigint, string][] = [
  [86400n * 30n, "mo"],
  [86400n * 7n, "w"],
  [86400n, "d"],
  [3600n, "h"],
  [60n, "m"],
];

/** Relative deadline text. The register uses "closes in 3d" style per design/landing.html. */
export function relativeDeadline(deadline: bigint | number, nowMs = Date.now()): string {
  const secs = Number(BigInt(deadline) - BigInt(Math.floor(nowMs / 1000)));
  if (secs <= 0) return "closed";
  for (const [size, unit] of UNITS) {
    if (secs >= Number(size)) {
      const n = Math.floor(secs / Number(size));
      return `${n}${unit} left`;
    }
  }
  return `${secs}s left`;
}

export const isTerminal = (status: number) =>
  status === STATUS.CLOSED || status === STATUS.EXPIRED;

/**
 * Escrow split, mirroring `_split_escrow` in contracts/docket.py. Reproduced rather than
 * imported so the UI can explain a settlement before the transaction is finalized; the chain
 * remains the authority and `tests/contract-parity.test.ts` pins the two together.
 */
export function splitEscrow(
  amount: bigint,
  verdict: number,
  score: number,
  thresholdBp: number,
): { payout: bigint; refund: bigint } {
  if (verdict === VERDICT.FULL) return { payout: amount, refund: 0n };
  if (verdict === VERDICT.REJECT) return { payout: 0n, refund: amount };
  if (verdict === VERDICT.PARTIAL) {
    if (score * 100 < thresholdBp) return { payout: 0n, refund: amount };
    const payout = (amount * BigInt(score)) / 100n;
    return { payout, refund: amount - payout };
  }
  return { payout: 0n, refund: 0n };
}

/** threshold_bp is basis points, so 5000 means a score of 50/100. */
export const thresholdPercent = (thresholdBp: number) => thresholdBp / 100;

/**
 * User-facing copy for the contract's error codes. `docs/07` classifies these; the UI must
 * name the actual code so a party understands why a write was refused.
 */
export const ERROR_COPY: Record<string, { title: string; body: string }> = {
  EXPECTED_ZERO_VALUE: {
    title: "This docket needs escrow",
    body: "A docket must be created with a payment attached, so the work is funded before anyone claims it.",
  },
  EXPECTED_EMPTY_SOW: {
    title: "The scope of work is empty",
    body: "Write what is being commissioned. Validators can only judge a deliverable against a stated scope.",
  },
  EXPECTED_EMPTY_CRITERIA: {
    title: "The acceptance criteria are empty",
    body: "List what “done” means. These criteria are what validators check the deliverable against.",
  },
  EXPECTED_INVALID_THRESHOLD: {
    title: "That acceptance threshold isn't valid",
    body: "The threshold is in basis points and must be 10,000 or less.",
  },
  EXPECTED_PAST_DEADLINE: {
    title: "This docket's deadline has passed",
    body: "Its deadline has already elapsed, so no further work can be recorded against it.",
  },
  EXPECTED_WRONG_STATUS: {
    title: "This docket can't take that action right now",
    body: "Someone else may have acted on it first, or it has already moved past this step. Refresh to see its current state.",
  },
  EXPECTED_CLIENT_CANNOT_CLAIM: {
    title: "You posted this docket",
    body: "The person who posted a docket can't also be the one who claims it. That separation is what makes adjudication meaningful.",
  },
  EXPECTED_NOT_ASSIGNED_WORKER: {
    title: "You aren't the assigned worker",
    body: "Only the worker who claimed this docket can submit a deliverable against it.",
  },
  EXPECTED_EMPTY_EVIDENCE: {
    title: "No evidence attached",
    body: "A deliverable needs at least one evidence URL. Validators fetch these themselves rather than trusting a description.",
  },
  EXPECTED_INVALID_URL: {
    title: "That evidence link isn't usable",
    body: "Evidence must be a publicly reachable https:// URL so validators can fetch it independently.",
  },
  EXPECTED_NOT_CLIENT: {
    title: "Only the client can do that",
    body: "Accepting or disputing a deliverable is the client's decision to make.",
  },
  EXPECTED_NOT_YET_EXPIRED: {
    title: "This docket hasn't expired yet",
    body: "A refund can only be claimed once its deadline has passed.",
  },
  EXPECTED_ESCROW_INVARIANT: {
    title: "Settlement didn't balance",
    body: "The payout and refund did not add up to the escrowed amount, so settlement was refused. No funds moved. Please report this.",
  },
  EXTERNAL_UNREACHABLE_EVIDENCE: {
    title: "An evidence link couldn't be reached",
    body: "Validators couldn't fetch one of the submitted evidence URLs. The docket resolves toward a rejected verdict rather than pausing adjudication.",
  },
  LLM_ERROR_MALFORMED_VERDICT: {
    title: "The verdict wasn't readable",
    body: "Validators returned a response that wasn't valid structured output, so adjudication couldn't complete. Retrying usually resolves it.",
  },
  LLM_ERROR_INVALID_VERDICT: {
    title: "The verdict wasn't recognised",
    body: "The verdict wasn't one of full, partial or reject, so adjudication couldn't complete.",
  },
  LLM_ERROR_SCORE_OUT_OF_RANGE: {
    title: "The compliance score was out of range",
    body: "The score must be between 0 and 100, so adjudication couldn't complete.",
  },
};

export const unknownErrorCopy = (code: string) => ({
  title: "That action was refused",
  body: `The contract rejected this transaction. Error code: ${code}`,
});

/** Pull a contract error code out of whatever the SDK or RPC threw. */
export function extractErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as Record<string, unknown>;

  // genlayer-js surfaces the leader receipt on the cause of an RPC error.
  const receipt = (e.cause as Record<string, unknown> | undefined)?.data as
    | Record<string, unknown>
    | undefined;
  const receiptBody = (receipt?.receipt ?? receipt) as Record<string, unknown> | undefined;

  const stderr = receiptBody?.genvm_result as Record<string, unknown> | undefined;
  const text = typeof stderr?.stderr === "string" ? stderr.stderr : "";
  const match = text.match(/\b(EXPECTED_[A-Z_]+|EXTERNAL_[A-Z_]+|LLM_ERROR_[A-Z_]+)\b/);
  if (match) return match[1];

  const description =
    (stderr?.error_description as string | undefined) ??
    (e.shortMessage as string | undefined) ??
    (e.message as string | undefined) ??
    "";
  const loose = description.match(/\b(EXPECTED_[A-Z_]+|EXTERNAL_[A-Z_]+|LLM_ERROR_[A-Z_]+)\b/);
  if (loose) return loose[1];
  return null;
}