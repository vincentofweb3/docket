"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TxStatusToast } from "@/components/TxStatusToast";
import { runWrite, type TxPhase } from "@/lib/tx";
import { detectInjectedProvider, type Eip1193Provider } from "@/lib/wallet";
import { STATUS } from "@/lib/docket";
import { network } from "@/lib/config";

/**
 * The action available at each docket stage.
 *
 * Which action is offered depends on whose wallet is connected relative to the docket's
 * client/worker, so the component needs to know both roles. It resolves the connected account
 * client-side and renders the matching action rather than exposing every button to everyone.
 */
export function DocketActions({
  docketId,
  status,
  deadlinePassed,
  client,
  worker,
}: {
  docketId: number;
  status: number;
  deadlinePassed: boolean;
  client?: string;
  worker?: string;
}) {
  const router = useRouter();
  const [account, setAccount] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxPhase>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  const hasWallet = typeof window !== "undefined" && Boolean(detectInjectedProvider());

  if (!hasWallet) {
    return (
      <div className="wallet-gate">
        <h3>Connect a wallet to act on this docket</h3>
        <p>
          You can read every docket without one — this record, the escrow, and any verdict are
          all public. Claiming, submitting, and resolving require a GenLayer-enabled wallet on{" "}
          {network.label}.
        </p>
        <a className="btn" href="/connect-wallet">
          Connect wallet
        </a>
      </div>
    );
  }

  const doWrite = async (title: string, fn: (provider: Eip1193Provider, account: string) => Promise<unknown>) => {
    setBusy(true);
    const provider = detectInjectedProvider();
    if (!provider) {
      setBusy(false);
      return;
    }
    const resolved =
      account ?? ((await provider.request({ method: "eth_accounts" })) as string[])[0];
    setAccount(resolved ?? null);
    await runWrite({ title, send: () => fn(provider, resolved), onPhase: setPhase });
    setBusy(false);
    router.refresh();
  };

  const isClient = Boolean(account && client && account.toLowerCase() === client.toLowerCase());
  const isWorker = Boolean(account && worker && account.toLowerCase() === worker.toLowerCase());

  return (
    <div className="panel">
      <h2>Actions</h2>

      <TxStatusToast phase={phase} />

      {!account ? (
        <div className="action-row">
          <button
            className="btn"
            onClick={async () => {
              const provider = detectInjectedProvider();
              const accs = (await provider?.request({ method: "eth_requestAccounts" })) as string[];
              setAccount(accs?.[0] ?? null);
              router.refresh();
            }}
            disabled={busy}
          >
            Connect to see your actions
          </button>
          <span className="muted">
            Docket actions depend on whether you posted or claimed this docket.
          </span>
        </div>
      ) : status === STATUS.OPEN ? (
        <div className="action-stack">
          <div className="action-row">
            <button
              className="btn"
              disabled={busy || isClient}
              onClick={() =>
                doWrite("Claiming docket", (p, a) =>
                  sendWrite(p, a, "claim_docket", [docketId]),
                )
              }
            >
              Claim this docket
            </button>
            {isClient ? (
              <span className="muted">You posted this, so you can&apos;t also claim it.</span>
            ) : null}
          </div>
          {deadlinePassed ? (
            <div className="action-row">
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={() =>
                  doWrite("Reclaiming escrow", (p, a) => sendWrite(p, a, "refund_expired", [docketId]))
                }
              >
                Reclaim escrowed funds
              </button>
              <span className="muted">Its deadline has passed, so it can be refunded.</span>
            </div>
          ) : null}
        </div>
      ) : status === STATUS.CLAIMED ? (
        <div className="action-stack">
          {isWorker ? (
            <button className="btn" onClick={() => (window.location.href = `/docket/${docketId}/submit`)}>
              Submit a deliverable
            </button>
          ) : (
            <p className="muted">
              A worker has claimed this docket and is preparing a deliverable.
            </p>
          )}
          {deadlinePassed ? (
            <div className="action-row">
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={() =>
                  doWrite("Reclaiming escrow", (p, a) => sendWrite(p, a, "refund_expired", [docketId]))
                }
              >
                Reclaim escrowed funds
              </button>
              <span className="muted">Permissionless — anyone can trigger this after the deadline.</span>
            </div>
          ) : null}
        </div>
      ) : status === STATUS.SUBMITTED ? (
        <div className="action-stack">
          {isClient ? (
            <>
              <p className="muted">
                A deliverable was submitted. Accept to release the escrow, or dispute it to have
                validators judge it against your acceptance criteria.
              </p>
              <div className="action-row">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    doWrite("Accepting deliverable", (p, a) =>
                      sendWrite(p, a, "accept_deliverable", [docketId]),
                    )
                  }
                >
                  Accept &amp; release escrow
                </button>
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() =>
                    doWrite("Disputing deliverable", (p, a) =>
                      sendWrite(p, a, "dispute_deliverable", [docketId]),
                    )
                  }
                >
                  Dispute — have validators judge it
                </button>
              </div>
              <p className="muted small">
                Disputing starts real AI adjudication and typically takes several minutes. That
                wait is normal.
              </p>
            </>
          ) : (
            <p className="muted">
              Waiting on the client to accept or dispute this deliverable.
            </p>
          )}
        </div>
      ) : status === STATUS.ADJUDICATING ? (
        <div className="undetermined">
          <h4>Validators are adjudicating</h4>
          <p>
            This docket is in AI adjudication. Validators independently fetch the evidence URLs
            and judge the deliverable against the acceptance criteria. This takes several
            minutes and needs nothing from you — it is not stuck.
          </p>
        </div>
      ) : (
        <p className="muted">No action is available at this stage.</p>
      )}
    </div>
  );
}

/**
 * Send an Intelligent Contract write through the injected wallet.
 *
 * genlayer-js's `metamaskClient` only reports whether the GenLayer Snap is installed; it does
 * not sign, so the raw transaction goes through the EIP-1193 provider directly. The exact
 * request shape depends on the wallet's GenLayer support, so this is deliberately thin and
 * reports failures rather than pretending success.
 */
async function sendWrite(
  provider: Eip1193Provider,
  account: string,
  method: string,
  args: unknown[],
): Promise<string> {
  const payload = { to: process.env.NEXT_PUBLIC_DOCKET_CONTRACT_ADDRESS, method, args, from: account };
  const result = (await provider.request({
    method: "genlayer_sendTransaction",
    params: [payload],
  })) as string;
  return result;
}