"use client";

import { useState } from "react";
import { LIFECYCLE_STAGES, TX_STATUS, explorerTxUrl, type TxPhase, type TxStatus } from "@/lib/tx";
import { ERROR_COPY, unknownErrorCopy } from "@/lib/docket";

/**
 * Transaction status, per design/components.html.
 *
 * Never a generic spinner: GenLayer's lifecycle has distinct stages a person should see, and a
 * disputed adjudication legitimately takes minutes. `undetermined` gets its own treatment
 * because it needs no action and looks alarming otherwise.
 */
export function TxStatusToast({ phase }: { phase: TxPhase }) {
  const [open, setOpen] = useState(false);
  if (phase.kind === "idle") return null;

  if (phase.kind === "sending") {
    return (
      <div className="toast" role="status" aria-live="polite">
        <div className="spinner" aria-hidden />
        <div className="toast-body">
          <p className="toast-title">{phase.title}…</p>
          <p className="toast-sub">signing with your wallet</p>
        </div>
      </div>
    );
  }

  if (phase.kind === "failed") {
    const copy = phase.code ? (ERROR_COPY[phase.code] ?? unknownErrorCopy(phase.code)) : null;
    return (
      <div className="toast failed" role="alert">
        <div className="toast-icon err" aria-hidden>
          !
        </div>
        <div className="toast-body">
          <p className="toast-title">{copy?.title ?? "That action was refused"}</p>
          <p className="toast-sub">
            {phase.code ? <code>{phase.code}</code> : (phase.message ?? "Unknown error")}
          </p>
          {copy ? <p className="toast-detail">{copy.body}</p> : null}
        </div>
      </div>
    );
  }

  if (phase.kind === "undetermined") {
    return (
      <div className="undetermined" role="status" aria-live="polite">
        <h4>
          {phase.hash ? "This transaction is still live" : "This dispute is undetermined"}
        </h4>
        <p>{phase.message}</p>
        {phase.hash ? (
          <p className="mono">
            <a href={explorerTxUrl(phase.hash)} target="_blank" rel="noreferrer">
              {phase.hash.slice(0, 10)}…{phase.hash.slice(-6)} →
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  if (phase.kind === "finalized") {
    return (
      <div className="toast done" role="status" aria-live="polite">
        <div className="toast-icon ok" aria-hidden>
          ✓
        </div>
        <div className="toast-body">
          <p className="toast-title">Finalized</p>
          <p className="toast-sub">
            {phase.hash.slice(0, 10)}…{phase.hash.slice(-6)} · permanent
          </p>
        </div>
        <a className="toast-link" href={explorerTxUrl(phase.hash)} target="_blank" rel="noreferrer">
          View →
        </a>
      </div>
    );
  }

  // tracking
  return (
    <div className="toast" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <div className="toast-body">
        <p className="toast-title">{stageTitle(phase.status)}</p>
        <p className="toast-sub">
          {phase.hash.slice(0, 10)}…{phase.hash.slice(-6)} · {phase.status.toLowerCase()}
        </p>
        <p className="toast-detail">{stageDetail(phase.status)}</p>
      </div>
      <button className="toast-link as-button" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide" : "Stages"}
      </button>
      {open ? (
        <div className="lifecycle" role="group" aria-label="Transaction lifecycle">
          {LIFECYCLE_STAGES.map((s) => {
            const reached = isReached(s.key, phase.status);
            const current = s.key === "ACCEPTED" ? phase.status === TX_STATUS.ACCEPTED : false;
            return (
              <div key={s.key} className={`lifecycle-row${reached ? "" : " pending"}`}>
                <span className={`lc-dot ${reached ? "done" : current ? "active" : "pending"}`} aria-hidden />
                <span>
                  {s.label}
                  {current ? <em className="lc-now"> — now</em> : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function isReached(stageKey: string, current: TxStatus) {
  const stage = LIFECYCLE_STAGES.find((s) => s.key === stageKey);
  if (!stage) return false;
  if (stageKey === "SUBMITTED") return true;
  return stage.done.includes(current);
}

function stageTitle(status: TxStatus) {
  switch (status) {
    case TX_STATUS.PENDING:
      return "Pending";
    case TX_STATUS.PROPOSING:
      return "Proposing & committing";
    case TX_STATUS.COMMITTING:
      return "Committing votes";
    case TX_STATUS.REVEALING:
      return "Revealing votes";
    case TX_STATUS.ACCEPTED:
    case TX_STATUS.READY_TO_FINALIZE:
      return "Accepted — entering the finality window";
    case TX_STATUS.APPEAL_COMMITTING:
    case TX_STATUS.APPEAL_REVEALING:
      return "Appeal in progress";
    case TX_STATUS.VALIDATORS_TIMEOUT:
      return "Validators timed out — retrying with a new committee";
    case TX_STATUS.LEADER_TIMEOUT:
      return "Leader timed out — a new leader is being selected";
    default:
      return "Submitted";
  }
}

function stageDetail(status: TxStatus) {
  if (status === TX_STATUS.ACCEPTED || status === TX_STATUS.READY_TO_FINALIZE) {
    return "Validators agreed. The result becomes final when the appeal window closes — it can still be appealed until then.";
  }
  if (status === TX_STATUS.VALIDATORS_TIMEOUT) {
    return "The committee didn't act in time. The protocol automatically retries with a fresh committee; nothing is required from you.";
  }
  if (status === TX_STATUS.LEADER_TIMEOUT) {
    return "The selected leader didn't propose in time. The protocol drops that leader and selects another automatically.";
  }
  if (status === TX_STATUS.REVEALING) {
    return "Validators are revealing their votes. A disagreement here triggers a leader rotation, which is why this can take a while.";
  }
  return LIFECYCLE_STAGES.find((s) => s.key === status)?.detail ?? "Tracking on-chain progress.";
}