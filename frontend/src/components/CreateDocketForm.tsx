"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TxStatusToast } from "@/components/TxStatusToast";
import { NetworkWarning } from "@/components/NetworkWarning";
import { runWrite, type TxPhase } from "@/lib/tx";
import { detectInjectedProvider } from "@/lib/wallet";
import { useWallet } from "@/lib/wallet-context";
import { sendContractWrite } from "@/lib/wallet-write";
import { invalidateDocketScan } from "@/lib/scan-cache";

const GEN = 10n ** 18n;

/**
 * Post a docket.
 *
 * Validates client-side against the same rules the contract enforces, so someone gets a clear
 * message before spending a transaction. The contract remains the authority — this is
 * convenience, not a substitute for its guards.
 */
export function CreateDocketForm() {
  const router = useRouter();
  const { account, connect, hasWallet, provider } = useWallet();
  const [sow, setSow] = useState("");
  const [criteria, setCriteria] = useState("");
  const [threshold, setThreshold] = useState("50");
  const [days, setDays] = useState("7");
  const [amount, setAmount] = useState("1000");
  const [phase, setPhase] = useState<TxPhase>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!sow.trim()) e.sow = "Describe what is being commissioned.";
    if (!criteria.trim()) e.criteria = "List what counts as done — this is what validators judge against.";
    const bp = Number(threshold);
    if (!Number.isFinite(bp) || bp < 0 || bp > 100) e.threshold = "Enter 0–100.";
    const d = Number(days);
    if (!Number.isFinite(d) || d < 1) e.days = "At least 1 day.";
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) e.amount = "Enter an amount greater than zero.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    if (!account) {
      setPhase({
        kind: "failed",
        code: null,
        message: "Connect a GenLayer-enabled wallet before posting — posting a docket requires signing the escrow.",
      });
      return;
    }
    const provider = detectInjectedProvider();
    if (!provider) {
      setPhase({ kind: "failed", code: null, message: "No wallet detected." });
      return;
    }
    setBusy(true);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(days) * 86400);
    const bp = Math.round(Number(threshold) * 100); // contract takes basis points

    const outcome = await runWrite({
      title: "Posting docket",
      send: () =>
        sendContractWrite(provider, account as `0x${string}`, {
          method: "create_docket",
          args: [sow.trim(), criteria.trim(), bp, deadline.toString()],
          value: BigInt(amount) * GEN,
        }),
      onPhase: setPhase,
    });
    setBusy(false);

    // Only navigate once the transaction actually finalized. The previous version read `phase`
    // after awaiting, which is a stale closure, so a failed post still redirected and looked
    // successful — the exact symptom reported.
    if (outcome.ok) {
      // The new docket id cannot be read from the transaction (the SDK does not surface a
      // method's return value either), so drop the cached docket scan and let My Dockets
      // re-read it. Otherwise the new docket stays invisible for up to a minute.
      invalidateDocketScan();
      router.push("/my-dockets");
    }
  };

  return (
    <div className="panel">
      <NetworkWarning provider={provider} />
      <TxStatusToast phase={phase} />

      <div className="field">
        <label htmlFor="sow">Scope of work</label>
        <p className="hint">What is being commissioned, in plain language.</p>
        <textarea
          id="sow"
          value={sow}
          onChange={(e) => setSow(e.target.value)}
          placeholder="Publish an implementation guide for the HTTP/1.1 specification"
        />
        {errors.sow ? <p className="field-error">{errors.sow}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="criteria">Acceptance criteria</label>
        <p className="hint">
          One per line. Validators fetch the evidence themselves and judge it against exactly
          this, so vagueness here directly causes disputes you didn&apos;t intend.
        </p>
        <textarea
          id="criteria"
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder={"- Must cite the published RFC as an https URL\n- Must be guidance, not a copy of the specification"}
        />
        {errors.criteria ? <p className="field-error">{errors.criteria}</p> : null}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="amount">Escrow amount (GEN)</label>
          <p className="hint">
            Held by the contract, released by verdict. Paid in GEN on the active network —
            this is real value once the app is pointed at a funded network.
          </p>
          <input
            id="amount"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount ? <p className="field-error">{errors.amount}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="threshold">Partial-release threshold (%)</label>
          <p className="hint">Below this compliance score, a partial verdict refunds in full.</p>
          <input
            id="threshold"
            type="number"
            min="0"
            max="100"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          {errors.threshold ? <p className="field-error">{errors.threshold}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="days">Deadline (days)</label>
          <p className="hint">After this, anyone can refund the escrow.</p>
          <input
            id="days"
            type="number"
            min="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          {errors.days ? <p className="field-error">{errors.days}</p> : null}
        </div>
      </div>

      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? "Working…" : "Post docket and escrow funds"}
      </button>
    </div>
  );
}
