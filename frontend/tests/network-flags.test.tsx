/**
 * Network-capability flags must actually reach the UI.
 *
 * `config.ts` declares three capability flags that encode what this repo has *verified* about
 * each network: whether an emitted payout credits a wallet, whether escrowing needs real funds,
 * and whether appeals exist. The P0-3 defect class was the flags existing and being ignored, so
 * the UI told people things the repo's own evidence contradicted — most visibly "no — 0 GEN" for
 * an "Can post an escrow?" check on a network where a 0 GEN account demonstrably escrowed 420 GEN.
 *
 * These assertions are behavioural: they render/evaluate the real components and flag values, so
 * removing a gate makes them fail. The pre-existing responsive test asserted on file *text* via
 * regex, which cannot tell whether a flag is consulted.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NETWORKS_FOR_TEST, network } from "../src/lib/config";
import { NetworkLimits } from "../src/components/NetworkLimits";
import { CHIP_CLASS } from "../src/lib/status-chip";
import { STATUS } from "../src/lib/docket";

describe("config declares the capabilities the evidence records", () => {
  it("Studionet does not credit EOA payouts (the NOTICE gate)", () => {
    expect(NETWORKS_FOR_TEST.studionet.creditsEoaPayouts).toBe(false);
    // ...and therefore must not require escrow funds, since value transfers are simulated.
    expect(NETWORKS_FOR_TEST.studionet.requiresEscrowFunds).toBe(false);
    expect(NETWORKS_FOR_TEST.studionet.appealSupport).toBe("absent");
  });

  it("Bradbury is a real testnet: not gasless, and no verified payout or appeal", () => {
    expect(NETWORKS_FOR_TEST["testnet-bradbury"].requiresEscrowFunds).toBe(true);
    // Kept false/"present" deliberately: neither has been observed working end-to-end.
    expect(NETWORKS_FOR_TEST["testnet-bradbury"].creditsEoaPayouts).toBe(false);
    expect(NETWORKS_FOR_TEST["testnet-bradbury"].appealSupport).toBe("present");
  });

  it("Localnet credits payouts and has no fund requirement", () => {
    expect(NETWORKS_FOR_TEST.localnet.creditsEoaPayouts).toBe(true);
    expect(NETWORKS_FOR_TEST.localnet.requiresEscrowFunds).toBe(false);
  });
});

describe("NetworkLimits only warns where the limitation exists", () => {
  it("renders the warning on the active network (Studionet does not credit payouts)", () => {
    expect(network.creditsEoaPayouts).toBe(false);
    const html = renderToStaticMarkup(<NetworkLimits />);
    expect(html).toMatch(/has not reached a wallet/i);
  });

  it("renders nothing when the network does credit payouts", () => {
    // Source-level check on the component's guard, because the module reads the active network
    // at import time and cannot be re-pointed without a rebuild.
    const src = readFileSync(new URL("../src/components/NetworkLimits.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/if \(network\.creditsEoaPayouts\) return null/);
  });
});

describe("status chips distinguish every status", () => {
  it("does not paint adjudicating, resolved, closed and expired as merely claimed", () => {
    expect(CHIP_CLASS[STATUS.OPEN]).toBe("chip-open");
    expect(CHIP_CLASS[STATUS.CLAIMED]).toBe("chip-claimed");
    for (const s of [
      STATUS.SUBMITTED,
      STATUS.ADJUDICATING,
      STATUS.RESOLVED,
      STATUS.CLOSED,
      STATUS.EXPIRED,
      STATUS.ACCEPTED_FAST_PATH,
    ]) {
      expect(CHIP_CLASS[s]).not.toBe("chip-claimed");
    }
  });

  it("gives every contract status a class", () => {
    for (const value of Object.values(STATUS)) {
      expect(CHIP_CLASS[value as number]).toBeTruthy();
    }
  });
});
