import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusChip } from "@/components/StatusChip";
import { VerdictSeal } from "@/components/VerdictSeal";
import { NetworkLimits } from "@/components/NetworkLimits";
import "./result.css";
import { network } from "@/lib/config";
import {
  STATUS,
  VERDICT,
  docketRef,
  formatGen,
  isTerminal,
  shortAddress,
  splitEscrow,
  thresholdPercent,
} from "@/lib/docket";
import { getDocket } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docketId = Number(id);
  if (!Number.isInteger(docketId) || docketId < 0) notFound();

  let docket;
  try {
    docket = await getDocket(docketId);
  } catch {
    notFound();
  }

  if (!isTerminal(docket.status)) {
    return (
      <div className="shell shell-narrow">
        <div className="docket-id mono">{docketRef(docketId)}</div>
        <h1>Not settled yet</h1>
        <div className="panel">
          <StatusChip status={docket.status} />
          <p className="muted">
            This docket hasn&apos;t resolved.{" "}
            <Link href={`/docket/${docketId}`}>Back to the docket</Link>.
          </p>
        </div>
      </div>
    );
  }

  const expired = docket.status === STATUS.EXPIRED;
  const disputed = docket.status === STATUS.CLOSED && docket.verdict !== VERDICT.FULL;
  const { payout, refund } = splitEscrow(
    docket.amount,
    docket.verdict,
    docket.score,
    docket.threshold_bp,
  );

  return (
    <div className="shell shell-narrow">
      <div className="docket-id mono">{docketRef(docketId)}</div>
      <h1>{docket.sow_text}</h1>

      <div className="panel case-stage">
        <div>
          <div className="eyebrow">
            {expired
              ? "Expired — escrow refunded"
              : disputed
                ? "Resolved via validator consensus"
                : "Settled — deliverable accepted"}
          </div>
          <h2 className="stage-headline">
            {expired
              ? `Escrow refunded — ${formatGen(docket.amount)} to client`
              : `Escrow released — ${formatGen(payout)} to worker, ${formatGen(refund)} refunded`}
          </h2>
          <p className="muted stage-body">
            {expired
              ? "Nobody delivered before the deadline, so the escrow returned to the client in full."
              : disputed
                ? "A dispute was raised. GenLayer validators independently fetched the linked evidence and reached consensus on the verdict below."
                : "The client accepted the deliverable directly, so no adjudication was needed. The escrow was released in full."}
          </p>
        </div>
      </div>

      {expired ? null : <VerdictSeal verdict={docket.verdict} score={docket.score} docketId={docketId} />}

      <div className="panel">
        <h2>Settlement breakdown</h2>
        <div className="kv">
          <span className="k">Verdict</span>
          <span className="v">{expired ? "expired" : verdictWord(docket.verdict)}</span>
        </div>
        <div className="kv">
          <span className="k">Compliance score</span>
          <span className="v">{expired ? "—" : `${docket.score} / 100`}</span>
        </div>
        <div className="kv">
          <span className="k">Acceptance threshold</span>
          <span className="v">{thresholdPercent(docket.threshold_bp).toFixed(0)} / 100</span>
        </div>
        <div className="kv">
          <span className="k">Escrow</span>
          <span className="v">{formatGen(docket.amount)}</span>
        </div>
        <div className="kv">
          <span className="k">Paid to worker</span>
          <span className="v">{formatGen(payout)}</span>
        </div>
        <div className="kv">
          <span className="k">Refunded to client</span>
          <span className="v">{formatGen(refund)}</span>
        </div>
        <div className="kv">
          <span className="k">Client</span>
          <span className="v">{shortAddress(docket.client)}</span>
        </div>
        <div className="kv">
          <span className="k">Worker</span>
          <span className="v">{shortAddress(docket.worker)}</span>
        </div>
        {docket.resolved_at > 0n ? (
          <div className="kv">
            <span className="k">Resolved</span>
            <span className="v">
              {new Date(Number(docket.resolved_at) * 1000).toISOString().replace("T", " ").slice(0, 16)}
            </span>
          </div>
        ) : null}
      </div>

      {docket.unmet_criteria.length > 0 ? (
        <div className="panel">
          <h2>Criteria validators found unmet</h2>
          <p className="hint muted">
            Produced by the validators during adjudication. This is the reasoning behind the
            score, not a summary written by either party.
          </p>
          <ul className="unmet-list">
            {docket.unmet_criteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {docket.evidence.length > 0 ? (
        <div className="panel">
          <h2>Evidence validators fetched</h2>
          <ul className="evidence-list">
            {docket.evidence.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer noopener">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {payout > 0n ? <NetworkLimits /> : null}

      <p className="muted">
        <Link href={`/docket/${docketId}`}>Back to the docket</Link> ·{" "}
        <Link href="/register">The register</Link>
      </p>
    </div>
  );
}

function verdictWord(v: number) {
  if (v === VERDICT.FULL) return "full";
  if (v === VERDICT.PARTIAL) return "partial";
  if (v === VERDICT.REJECT) return "reject";
  return "undecided";
}