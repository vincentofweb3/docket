import { network } from "@/lib/config";

/**
 * Surfaces a genuine network limitation next to the claim it qualifies.
 *
 * On Studionet an emitted payout finalizes with an execution error, so the recipient EOA is
 * never credited even though the escrow leaves the contract correctly. Saying so here is more
 * useful than a footnote nobody reads — someone looking at a settled docket deserves to know
 * the money has not landed in a wallet on this network.
 */
export function NetworkLimits() {
  return (
    <div className="capability-note">
      <strong>Escrow accounting is final - the payout has not reached a wallet on {network.label}</strong>
      The contract recorded the settlement and released escrow correctly. On {network.label} the
      emitted transfer to a worker&apos;s address finalizes with an execution error, because this
      network has no EVM layer or ghost contracts for a cross-layer transfer to land on. The
      worker&apos;s wallet balance is therefore unchanged.
      <br />
      <br />
      This is a network limitation rather than a defect in the settlement logic, and it is why
      the escrow figures above are read from contract state rather than from wallet balances.
      Verified on 2026-10-07 and recorded in{" "}
      <code>evidence/studionet-fund-trace-2026-10-07.json</code>.
    </div>
  );
}