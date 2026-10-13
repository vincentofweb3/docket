/**
 * The /api/tx/[hash] route handler, against a stubbed SDK.
 *
 * This mapping is where the number/name mismatch lived, so it is tested here rather than assumed
 * by its caller. The captured shapes below are real responses from the live Studionet node:
 * `client.getTransaction()` returns `status` as a number (7 for finalized) and `result` as a
 * number, with the readable status held separately in `statusName`.
 *
 * The endpoint's contract: `status` out as a NAME (tx.ts compares it against TX_STATUS strings),
 * `result` out as a NUMBER (evaluateFinalized compares it against TX_RESULT codes).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HASH = `0x${"a".repeat(64)}`;
const BAD_HASH = "0xnotahash";

/** Load the route fresh with `getTransaction` stubbed to return `tx`. */
async function loadRoute(tx: unknown) {
  vi.resetModules();
  const getTransaction = vi.fn(async () => tx);
  vi.doMock("../src/lib/genlayer", () => ({ getClient: () => ({ getTransaction }) }));
  const mod = await import("../src/app/api/tx/[hash]/route");
  return { GET: mod.GET as (r: Request, c: unknown) => Promise<Response>, getTransaction };
}

const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

describe("GET /api/tx/[hash]", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    vi.doUnmock("../src/lib/genlayer");
    vi.resetModules();
  });

  it("converts the numeric status to its NAME, keeping result numeric", async () => {
    // Exactly what the live node returned for the finalized create_docket.
    const { GET } = await loadRoute({
      status: 7,
      statusName: "FINALIZED",
      result: 6,
    });
    const body = await json(
      await GET(new Request("http://x/api/tx/" + HASH), { params: Promise.resolve({ hash: HASH }) }),
    );

    expect(body.status).toBe("FINALIZED");
    // Not "6": evaluateFinalized compares numerically.
    expect(body.result).toBe(6);
    expect(typeof body.result).toBe("number");
  });

  it("reproduces the original bug: a raw number 7 is NOT the name FINALIZED", async () => {
    // Guards the specific regression. If someone passes `status` through unconverted again,
    // runWrite's comparisons all become false and every write reports a timeout.
    const { GET } = await loadRoute({ status: 7, result: 6 });
    const body = await json(
      await GET(new Request("http://x/api/tx/" + HASH), { params: Promise.resolve({ hash: HASH }) }),
    );
    expect(body.status).not.toBe(7);
    expect(body.status).toBe("FINALIZED");
  });

  it("maps NO_MAJORITY result for the documented failed payout tx", async () => {
    const { GET } = await loadRoute({
      status: 7,
      statusName: "FINALIZED",
      result: 5,
    });
    const body = await json(
      await GET(new Request("http://x/api/tx/" + HASH), { params: Promise.resolve({ hash: HASH }) }),
    );
    expect(body.status).toBe("FINALIZED");
    expect(body.result).toBe(5);
  });

  it("handles a transaction with only a numeric status", async () => {
    for (const [n, name] of [
      [1, "PENDING"],
      [5, "ACCEPTED"],
      [6, "UNDETERMINED"],
      [8, "CANCELED"],
    ] as const) {
      const { GET } = await loadRoute({ status: n });
      const body = await json(
        await GET(new Request("http://x"), { params: Promise.resolve({ hash: HASH }) }),
      );
      expect(body.status).toBe(name);
    }
  });

  it("returns nulls for a missing transaction", async () => {
    const { GET } = await loadRoute(null);
    const body = await json(
      await GET(new Request("http://x"), { params: Promise.resolve({ hash: HASH }) }),
    );
    expect(body).toEqual({ status: null, result: null });
  });

  it("rejects a malformed hash without calling the node", async () => {
    const { GET, getTransaction } = await loadRoute({ status: 7 });
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ hash: BAD_HASH }),
    });
    expect(res.status).toBe(400);
    expect(getTransaction).not.toHaveBeenCalled();
  });

  it("returns nulls and a 502 when the RPC throws", async () => {
    vi.resetModules();
    vi.doMock("../src/lib/genlayer", () => ({
      getClient: () => ({
        getTransaction: async () => {
          throw new Error("rpc down");
        },
      }),
    }));
    const { GET } = await import("../src/app/api/tx/[hash]/route");
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ hash: HASH }),
    });
    expect(res.status).toBe(502);
    const body = await json(res);
    expect(body.status).toBeNull();
    expect(body.result).toBeNull();
  });
});