import { appealSupportNote } from "@/lib/wallet";
import { network } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Appeals are a native GenLayer transaction-level action, not a Docket method — the contract
 * has no appeal entry point by design, because an appeal challenges the *consensus decision*,
 * not the contract's logic.
 *
 * This page therefore explains the mechanism and reports whether the active network can
 * actually do it, rather than shipping a button wired to an RPC that does not exist.
 */
export default function AppealGuidePage() {
  const appeal = appealSupportNote();

  return (
    <div className="shell shell-narrow">
      <div className="eyebrow">Appeals</div>
      <h1>Appealing a verdict</h1>
      <p className="lede">
        If you think validators reached the wrong verdict, you can challenge the decision during
        its appeal window. The appeal is adjudicated by GenLayer itself — it is not a Docket
        feature, and the contract has no appeal method.
      </p>

      <div className="panel">
        <h2>How a challenge works</h2>
        <ol className="steps">
          <li>
            A decided transaction enters an appeal window. While it is open, anyone can post an
            appeal by paying the current appeal charge.
          </li>
          <li>
            A <strong>validator appeal</strong> re-checks an accepted decision with an entirely
            fresh committee. A <strong>leader appeal</strong> restarts the proposal round after an
            undetermined result.
          </li>
          <li>
            If the new committee&apos;s majority differs, the transaction returns for
            recomputation. If it matches, the appeal fails and the original result stands.
          </li>
          <li>
            Once no valid appeal remains, anyone can finalize — and the result becomes final and
            unappealable.
          </li>
        </ol>
      </div>

      <div className="panel">
        <h2>On {network.label}</h2>
        {appeal.supported ? (
          <>
            <p className="muted">{appeal.message}</p>
            <p className="muted">
              Read the charge immediately before submitting — it is a function of the current
              round, never a fixed bond.
            </p>
          </>
        ) : (
          <div className="capability-note">
            <strong>
              {appeal.support === "present"
                ? `Appeal infrastructure is deployed on ${network.label}, but no appeal has been completed here`
                : `Appeals cannot be submitted on ${network.label}`}
            </strong>
            {appeal.message}
          </div>
        )}
      </div>

      <p className="muted">
        Docket never asks an LLM what a verdict is likely to be, and never offers a way to skip
        adjudication. The verdict comes from validator consensus or it doesn&apos;t exist.
      </p>
    </div>
  );
}