/**
 * Contract-parity checks.
 *
 * The frontend duplicates the contract's numeric status/verdict codes and its escrow-splitting
 * rule. That duplication is deliberate (importing the Python contract into a browser build
 * would be worse coupling), which makes drift the real risk — a renamed status or a changed
 * rounding rule would silently misreport settlements.
 *
 * This parses contracts/docket.py and asserts the frontend constants still match. Run with:
 *   npm test
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { STATUS, VERDICT, splitEscrow } from "../src/lib/docket";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const contract = readFileSync(join(REPO, "contracts", "docket.py"), "utf8");

const readConst = (name: string) => {
  const m = contract.match(new RegExp(`^${name} = (\\d+)$`, "m"));
  if (!m) throw new Error(`could not find ${name} in contracts/docket.py`);
  return Number(m[1]);
};

describe("status codes match the contract", () => {
  it("every STATUS_* constant in docket.py has a matching frontend value", () => {
    const pairs: [keyof typeof STATUS, string][] = [
      ["OPEN", "STATUS_OPEN"],
      ["CLAIMED", "STATUS_CLAIMED"],
      ["SUBMITTED", "STATUS_SUBMITTED"],
      ["ADJUDICATING", "STATUS_ADJUDICATING"],
      ["RESOLVED", "STATUS_RESOLVED"],
      ["CLOSED", "STATUS_CLOSED"],
      ["EXPIRED", "STATUS_EXPIRED"],
      ["ACCEPTED_FAST_PATH", "STATUS_ACCEPTED_FAST_PATH"],
    ];
    for (const [front, pyName] of pairs) {
      expect(STATUS[front], `${front} vs ${pyName}`).toBe(readConst(pyName));
    }
  });
});

describe("verdict codes match the contract", () => {
  it("every VERDICT_* constant in docket.py has a matching frontend value", () => {
    const pairs: [keyof typeof VERDICT, string][] = [
      ["NONE", "VERDICT_NONE"],
      ["FULL", "VERDICT_FULL"],
      ["PARTIAL", "VERDICT_PARTIAL"],
      ["REJECT", "VERDICT_REJECT"],
    ];
    for (const [front, pyName] of pairs) {
      expect(VERDICT[front], `${front} vs ${pyName}`).toBe(readConst(pyName));
    }
  });
});

describe("escrow split matches _split_escrow", () => {
  const AMOUNT = 1000n;
  const THRESHOLD = 5000; // basis points => 50/100

  it("full pays the worker everything", () => {
    expect(splitEscrow(AMOUNT, VERDICT.FULL, 100, THRESHOLD)).toEqual({
      payout: AMOUNT,
      refund: 0n,
    });
  });

  it("reject refunds the client everything", () => {
    expect(splitEscrow(AMOUNT, VERDICT.REJECT, 0, THRESHOLD)).toEqual({
      payout: 0n,
      refund: AMOUNT,
    });
  });

  it("partial above the threshold pays proportionally", () => {
    expect(splitEscrow(AMOUNT, VERDICT.PARTIAL, 70, THRESHOLD)).toEqual({
      payout: 700n,
      refund: 300n,
    });
  });

  it("partial below the threshold refunds everything", () => {
    expect(splitEscrow(AMOUNT, VERDICT.PARTIAL, 40, THRESHOLD)).toEqual({
      payout: 0n,
      refund: AMOUNT,
    });
  });

  it("partial exactly at the boundary splits in half", () => {
    expect(splitEscrow(AMOUNT, VERDICT.PARTIAL, 50, THRESHOLD)).toEqual({
      payout: 500n,
      refund: 500n,
    });
  });

  it("conserves escrow for every verdict/score combination", () => {
    // Mirrors the contract's _assert_escrow_conserved invariant.
    for (const verdict of [VERDICT.FULL, VERDICT.PARTIAL, VERDICT.REJECT]) {
      for (let score = 0; score <= 100; score++) {
        const { payout, refund } = splitEscrow(AMOUNT, verdict, score, THRESHOLD);
        expect(payout + refund, `verdict=${verdict} score=${score}`).toBe(AMOUNT);
      }
    }
  });
});

describe("bounded validation limits match the contract", () => {
  it("MAX_RATIONALE_CHARS and the unmet-criteria caps are unchanged", () => {
    expect(readConst("MAX_RATIONALE_CHARS")).toBe(280);
    expect(readConst("MAX_UNMET_CRITERIA")).toBe(20);
    expect(readConst("MAX_UNMET_CRITERION_CHARS")).toBe(280);
  });

  it("threshold_bp is validated at 10000 in the contract", () => {
    expect(contract).toMatch(/threshold_bp > 10000/);
  });
});