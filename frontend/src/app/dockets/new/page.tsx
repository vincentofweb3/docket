import { CreateDocketForm } from "@/components/CreateDocketForm";
import { NetworkLimits } from "@/components/NetworkLimits";
import "@/components/tx.css";
import { network } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function NewDocketPage() {
  return (
    <div className="shell shell-narrow">
      <div className="eyebrow">Post work</div>
      <h1>Post a docket</h1>
      <p className="lede">
        Escrow the payment and write the scope in plain language. If you and the worker later
        disagree about whether the job was done, validators fetch the evidence and decide — not
        either of you.
      </p>

      <div style={{ height: 24 }} />
      <CreateDocketForm />
      <NetworkLimits />
      <p className="muted">
        Writing to {network.label}. Escrow and verdicts are final once consensus completes.
      </p>
    </div>
  );
}
