"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TxStatusToast } from "@/components/TxStatusToast";
import { MAX_EVIDENCE_URLS } from "@/lib/config";
import { runWrite, type TxPhase } from "@/lib/tx";
import { detectInjectedProvider, type Eip1193Provider } from "@/lib/wallet";

const CONTRACT = process.env.NEXT_PUBLIC_DOCKET_CONTRACT_ADDRESS as `0x${string}`;
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
    const provider = detectInjectedProvider();
    if (!provider) {
      setPhase({ kind: "failed", code: null, message: "No wallet detected. Connect a GenLayer-enabled wallet first." });
      return;
    }
    setBusy(true);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(days) * 86400);
    const bp = Math.round(Number(threshold) * 100); // contract takes basis points

    await runWrite({
      title: "Posting docket",
      send: async () => {
        // Ask the wallet to sign from its own selected account.
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        const hash = await provider.request({
          method: "genlayer_sendTransaction",
          params: [
            {
              to: CONTRACT,
              from: accounts[0],
              method: "create_docket",
              args: [sow.trim(), criteria.trim(), bp, deadline],
              value: BigInt(amount) * GEN,
            },
          ],
        });
        return hash as string;
      },
      onPhase: setPhase,
    });
    setBusy(false);
    if (phase.kind !== "failed") router.push("/my-dockets");
  };

  return (
    <div className="panel">
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
          <p className="hint">Held by the contract, released by verdict.</p>
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

/** Shared by the deliverable form; kept here to avoid a second wallet-import site. */
export async function sendMethod(
  provider: Eip1193Provider,
  account: string,
  method: string,
  args: unknown[],
  value = 0n,
): Promise<string> {
  return (await provider.request({
    method: "genlayer_sendTransaction",
    params: [{ to: CONTRACT, from: account, method, args, value }],
  })) as string;
}