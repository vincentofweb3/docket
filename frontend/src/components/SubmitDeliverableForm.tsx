"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TxStatusToast } from "@/components/TxStatusToast";
import { MAX_EVIDENCE_URLS } from "@/lib/config";
import { useWallet } from "@/lib/wallet-context";
import { sendContractWrite } from "@/lib/wallet-write";
import { invalidateDocketScan } from "@/lib/scan-cache";
import { runWrite, type TxPhase } from "@/lib/tx";
import { detectInjectedProvider } from "@/lib/wallet";

/**
 * Submit a deliverable against evidence URLs.
 *
 * The contract requires https and fetches nothing client-side — validators fetch these
 * themselves. So this form only validates the shape of a URL; it deliberately does not fetch,
 * preview, or summarise the evidence, and never asks an LLM what it thinks the verdict will be.
 */
export function SubmitDeliverableForm({ docketId }: { docketId: number }) {
  const router = useRouter();
  const { account, connect } = useWallet();
  const [urls, setUrls] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<TxPhase>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUrlAt = (i: number, v: string) =>
    setUrls((prev) => prev.map((u, idx) => (idx === i ? v : u)));

  const submit = async () => {
    const cleaned = urls.map((u) => u.trim()).filter(Boolean);

    if (cleaned.length === 0) {
      setError("Attach at least one evidence URL — validators need something to fetch.");
      return;
    }
    if (cleaned.length > MAX_EVIDENCE_URLS) {
      setError(`At most ${MAX_EVIDENCE_URLS} evidence URLs.`);
      return;
    }
    const bad = cleaned.find((u) => !u.startsWith("https://"));
    if (bad) {
      setError(`Evidence must be a public https:// URL. Rejected: ${bad}`);
      return;
    }
    setError(null);

    if (!account) {
      setPhase({
        kind: "failed",
        code: null,
        message: "Connect the wallet that claimed this docket to submit against it.",
      });
      return;
    }
    const provider = detectInjectedProvider();
    if (!provider) {
      setPhase({ kind: "failed", code: null, message: "No wallet detected." });
      return;
    }

    setBusy(true);
    const outcome = await runWrite({
      title: "Submitting deliverable",
      send: () =>
        sendContractWrite(provider, account as `0x${string}`, {
          method: "submit_deliverable",
          args: [docketId, cleaned, note],
        }),
      onPhase: setPhase,
    });
    setBusy(false);
    if (outcome.ok) {
      invalidateDocketScan();
      router.refresh();
    }
  };

  return (
    <div className="panel">
      <TxStatusToast phase={phase} />

      <p className="hint muted">
        Validators fetch these URLs independently during adjudication. Link to something
        durable and public - a deployed endpoint, a published document, a repository.
      </p>

      {urls.map((u, i) => (
        <div className="field" key={i}>
          <label htmlFor={`ev-${i}`}>Evidence URL {i + 1}</label>
          <input
            id={`ev-${i}`}
            type="text"
            value={u}
            onChange={(e) => setUrlAt(i, e.target.value)}
            placeholder="https://example.com/deliverable"
          />
          {urls.length > 1 ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => setUrls((prev) => prev.filter((_, idx) => idx !== i))}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}

      {urls.length < MAX_EVIDENCE_URLS ? (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setUrls((prev) => [...prev, ""])}
        >
          Add another URL
        </button>
      ) : null}

      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="note">Note to the client (optional)</label>
        <p className="hint">
          Context only. This is not evidence - validators judge the URLs, not this.
        </p>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Published and indexed; see the section on connection management."
        />
      </div>

      {error ? (
        <div className="error-banner">
          <span className="error-icon" aria-hidden>
            !
          </span>
          <div>
            <h4>Check the evidence</h4>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? "Working…" : "Submit deliverable"}
      </button>
    </div>
  );
}