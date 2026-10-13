/**
 * Write-lifecycle terminal-state handling.
 *
 * The bug this pins: `runWrite` read only `status` from /api/tx/[hash] and returned `ok: true`
 * whenever the status was FINALIZED. FINALIZED is a statement about *finality*, not about the
 * contract call succeeding. This repo already documents a transaction that reached FINALIZED and
 * did nothing useful:
 *
 *   0xa919c47c6872ed1c778cc1752e1c3cd2078d348bb0702cb0a05c6efc50fdde1d
 *   status 7 (FINALIZED), result 5 (NO_MAJORITY), leader execution_result ERROR, empty votes.
 *
 * Reported as success, CreateDocketForm would then invalidate its scan cache and navigate to
 * /my-dockets as though a docket had been posted. That is the same class of defect as the older
 * "redirect regardless of outcome" bug, so it needs a behavioural test rather than a comment.
 *
 * `evaluateFinalized` is exported as a pure function so the mapping is tested directly; the
 * `runWrite` tests below then cover that the decision is actually wired into the return value.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TX_RESULT, TX_STATUS, evaluateFinalized, runWrite, type TxPhase } from "../src/lib/tx";

const HASH = `0x${"a".repeat(64)}`;

/** Stub fetch so the poller sees a controlled /api/tx response. */
function stubTx(responses: { status: string; result?: number | null }[]) {
  let call = 0;
  const fetchMock = vi.fn(async () => {
    const body = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return {
      ok: true,
      json: async () => body,
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("evaluateFinalized", () => {
  it("accepts the result codes where the contract call took effect", () => {
    for (const r of [
      TX_RESULT.AGREE,
      TX_RESULT.DISAGREE,
      TX_RESULT.MAJORITY_AGREE,
      TX_RESULT.MAJORITY_DISAGREE,
    ]) {
      expect(evaluateFinalized(r)).toEqual({ ok: true, reason: null });
    }
  });

  it("rejects NO_MAJORITY, the code the documented failed payout tx carries", () => {
    const out = evaluateFinalized(TX_RESULT.NO_MAJORITY);
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/did not take effect/);
  });

  it("rejects the other failure codes with a real reason", () => {
    for (const [code, fragment] of [
      [TX_RESULT.TIMEOUT, /timed out/],
      [TX_RESULT.DETERMINISTIC_VIOLATION, /deterministic/],
    ] as const) {
      const out = evaluateFinalized(code);
      expect(out.ok).toBe(false);
      expect(out.reason).toMatch(fragment);
    }
  });

  it("treats an unknown code as failure, never as success", () => {
    const out = evaluateFinalized(99);
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/result code 99/);
  });

  it("does not claim success or failure when no result was reported", () => {
    expect(evaluateFinalized(null)).toEqual({ ok: false, reason: null });
    expect(evaluateFinalized(undefined)).toEqual({ ok: false, reason: null });
  });
});

describe("runWrite terminal states", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports ok when FINALIZED with a successful consensus result", async () => {
    stubTx([{ status: TX_STATUS.FINALIZED, result: TX_RESULT.MAJORITY_AGREE }]);
    const phases: TxPhase[] = [];
    const p = runWrite({
      title: "Posting",
      send: async () => HASH,
      onPhase: (ph) => phases.push(ph),
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toEqual({ ok: true, hash: HASH });
    expect(phases.some((x) => x.kind === "finalized")).toBe(true);
  });

  it("reports FAILURE when FINALIZED but the consensus result is NO_MAJORITY", async () => {
    // The exact regression: status alone said success.
    stubTx([{ status: TX_STATUS.FINALIZED, result: TX_RESULT.NO_MAJORITY }]);
    const phases: TxPhase[] = [];
    const p = runWrite({
      title: "Settling",
      send: async () => HASH,
      onPhase: (ph) => phases.push(ph),
    });
    await vi.advanceTimersByTimeAsync(10);

    const out = await p;
    expect(out.ok).toBe(false);
    expect(out).toMatchObject({ hash: HASH });
    expect((out as { reason: string }).reason).toMatch(/finalized but failed/);
    // Must NOT announce a successful finalization.
    expect(phases.some((x) => x.kind === "finalized")).toBe(false);
    expect(phases.some((x) => x.kind === "failed")).toBe(true);
  });

  it("reports failure when FINALIZED with no result reported at all", async () => {
    stubTx([{ status: TX_STATUS.FINALIZED, result: null }]);
    const p = runWrite({ title: "x", send: async () => HASH, onPhase: () => {} });
    await vi.advanceTimersByTimeAsync(10);
    const out = await p;
    expect(out.ok).toBe(false);
    expect((out as { reason: string }).reason).toMatch(/no result/);
  });

  it("still reports failure for UNDETERMINED and CANCELED", async () => {
    for (const status of [TX_STATUS.UNDETERMINED, TX_STATUS.CANCELED]) {
      stubTx([{ status, result: null }]);
      const p = runWrite({ title: "x", send: async () => HASH, onPhase: () => {} });
      await vi.advanceTimersByTimeAsync(10);
      expect((await p).ok).toBe(false);
    }
  });

  it("does not claim success when the wallet send itself throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response),
    );
    const out = await runWrite({
      title: "x",
      send: async () => {
        throw new Error("user rejected");
      },
      onPhase: () => {},
    });
    expect(out.ok).toBe(false);
    expect(out.hash).toBeNull();
  });
});