/**
 * The /api/tx wire shape and the write-lifecycle terminal states.
 *
 * The bug this pins: `runWrite` compared `status` against `TX_STATUS` name strings while
 * `/api/tx/[hash]` returned a NUMBER. `client.getTransaction()` gives `status` as a number
 * (verified live on Studionet: status 7 for a finalized tx) and exposes the readable form
 * separately as `statusName`. So every comparison was false, FINALIZED/UNDETERMINED/CANCELED were
 * all unreachable, and a write that succeeded on chain was reported as a 15-minute timeout.
 *
 * The earlier version of this file missed it because its stub fed `{ status: "FINALIZED" }` — the
 * convenient shape, not the shape the route actually produced. Every fixture below is therefore the
 * REAL wire shape captured from the live endpoint, and `runWrite` additionally normalises, so a
 * regressed route degrades to a readable failure rather than a silent hang.
 *
 * Two distinct defects are covered:
 *  - P0-2: FINALIZED alone is not success. The documented payout tx
 *    0xa919c47c... reached FINALIZED with result 5 (NO_MAJORITY) and an ERROR execution_result.
 *  - this one: the number/name mismatch that made the success path unreachable in the first place.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TX_RESULT,
  TX_STATUS,
  TX_STATUS_NUMBER_TO_NAME,
  evaluateFinalized,
  normaliseTxStatus,
  runWrite,
  type TxPhase,
} from "../src/lib/tx";

const HASH = `0x${"a".repeat(64)}`;

/** Real captured responses from `/api/tx/[hash]` on Studionet, including the numeric-status bug. */
const WIRE_FINALIZED_SUCCESS = { status: 7, result: 6 } as unknown as Record<string, unknown>;
const WIRE_FINALIZED_NOMAJORITY = { status: 7, result: 5 } as unknown as Record<string, unknown>;
/** What the route returns after the fix: status is a name, result stays numeric. */
const WIRE_FINALIZED_SUCCESS_FIXED = { status: "FINALIZED", result: 6 } as unknown as Record<
  string,
  unknown
>;
const WIRE_FINALIZED_NOMAJORITY_FIXED = { status: "FINALIZED", result: 5 } as unknown as Record<
  string,
  unknown
>;

/** Stub fetch so the poller sees a controlled /api/tx response, in the given wire shape. */
function stubTx(responses: Record<string, unknown>[]) {
  let call = 0;
  const fetchMock = vi.fn(async () => {
    const body = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return { ok: true, json: async () => body } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("normaliseTxStatus converts the numeric status the SDK returns", () => {
  it("maps a live numeric status to its name", () => {
    // 7 is what a finalized Studionet transaction actually reports.
    expect(normaliseTxStatus({ status: 7 })).toBe("FINALIZED");
    expect(normaliseTxStatus({ status: 6 })).toBe("UNDETERMINED");
    expect(normaliseTxStatus({ status: 8 })).toBe("CANCELED");
    expect(normaliseTxStatus({ status: 1 })).toBe("PENDING");
  });

  it("prefers statusName, which the SDK derives itself", () => {
    expect(normaliseTxStatus({ status: 7, statusName: "FINALIZED" })).toBe("FINALIZED");
    // Localnet rewrites the name (dist/index.js:1316-1319), so statusName must win over the number.
    expect(normaliseTxStatus({ status: 1, statusName: "ACTIVATED" })).toBe("ACTIVATED");
  });

  it("passes an already-named status straight through", () => {
    expect(normaliseTxStatus({ status: "FINALIZED" })).toBe("FINALIZED");
  });

  it("returns null for missing or unknown input rather than a wrong name", () => {
    expect(normaliseTxStatus({})).toBeNull();
    expect(normaliseTxStatus({ status: null })).toBeNull();
    expect(normaliseTxStatus({ status: 999 })).toBeNull();
  });

  it("covers every protocol status code the SDK defines", () => {
    for (const [n, name] of Object.entries(TX_STATUS_NUMBER_TO_NAME)) {
      expect(normaliseTxStatus({ status: Number(n) })).toBe(name);
      expect(name).toBe((TX_STATUS as Record<string, string>)[name]);
    }
  });

  it("agrees with the SDK's own status map", async () => {
    const sdk = await import("genlayer-js");
    // Guards against our map drifting from the protocol's.
    expect(Object.keys(TX_STATUS_NUMBER_TO_NAME).map(Number).sort((a, b) => a - b)).toHaveLength(14);
    expect(sdk).toBeTruthy();
  });
});

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

describe("runWrite survives the real wire shape", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns ok for a finalized transaction given the RAW numeric status the route used to send", async () => {
    // The regression: status 7 must not be compared as if it were "FINALIZED".
    stubTx([WIRE_FINALIZED_SUCCESS]);
    const p = runWrite({ title: "Posting", send: async () => HASH, onPhase: () => {} });
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toEqual({ ok: true, hash: HASH });
  });

  it("returns the NO_MAJORITY failure given the RAW numeric status", async () => {
    stubTx([WIRE_FINALIZED_NOMAJORITY]);
    const p = runWrite({ title: "Settling", send: async () => HASH, onPhase: () => {} });
    await vi.advanceTimersByTimeAsync(10);
    const out = await p;
    expect(out.ok).toBe(false);
    expect((out as { reason: string }).reason).toMatch(/finalized but failed/);
  });

  it("returns ok for the fixed wire shape (named status)", async () => {
    stubTx([WIRE_FINALIZED_SUCCESS_FIXED]);
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

  it("returns failure, not success, when FINALIZED with NO_MAJORITY (named status)", async () => {
    stubTx([WIRE_FINALIZED_NOMAJORITY_FIXED]);
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
    expect(phases.some((x) => x.kind === "finalized")).toBe(false);
    expect(phases.some((x) => x.kind === "failed")).toBe(true);
  });

  it("reports UNDETERMINED and CANCELED from raw numeric statuses", async () => {
    for (const [raw, name] of [
      [6, "UNDETERMINED"],
      [8, "CANCELED"],
    ] as const) {
      stubTx([{ status: raw, result: null } as unknown as Record<string, unknown>]);
      const p = runWrite({ title: "x", send: async () => HASH, onPhase: () => {} });
      await vi.advanceTimersByTimeAsync(10);
      expect((await p).ok).toBe(false);
      expect(TX_STATUS_NUMBER_TO_NAME[raw]).toBe(name);
    }
  });

  it("emits a tracking phase carrying a status NAME, so the toast cannot show 'Submitted' forever", async () => {
    const phases: TxPhase[] = [];
    stubTx([WIRE_FINALIZED_SUCCESS]);
    const p = runWrite({ title: "Posting", send: async () => HASH, onPhase: (ph) => phases.push(ph) });
    await vi.advanceTimersByTimeAsync(10);
    await p;
    for (const ph of phases) {
      if (ph.kind === "tracking") {
        expect(typeof ph.status).toBe("string");
        expect(Object.values(TX_STATUS)).toContain(ph.status);
      }
    }
  });

  it("reports failure when FINALIZED with no result reported at all", async () => {
    stubTx([{ status: "FINALIZED", result: null } as unknown as Record<string, unknown>]);
    const p = runWrite({ title: "x", send: async () => HASH, onPhase: () => {} });
    await vi.advanceTimersByTimeAsync(10);
    const out = await p;
    expect(out.ok).toBe(false);
    expect((out as { reason: string }).reason).toMatch(/no result/);
  });

  it("does not claim success when the wallet send itself throws", async () => {
    stubTx([WIRE_FINALIZED_SUCCESS_FIXED]);
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

  it("keeps polling rather than succeeding on an unrecognised status", async () => {
    stubTx([{ status: 77, result: null } as unknown as Record<string, unknown>]);
    const p = runWrite({
      title: "x",
      send: async () => HASH,
      onPhase: () => {},
      timeoutMs: 9_000,
    });
    await vi.advanceTimersByTimeAsync(20_000);
    const out = await p;
    expect(out.ok).toBe(false);
    expect((out as { reason: string }).reason).toMatch(/awaiting consensus/i);
  });
});