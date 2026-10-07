import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusChip } from "@/components/StatusChip";
import { DocketActions } from "@/components/DocketActions";
import "./detail.css";
import { CONTRACT_ADDRESS, network } from "@/lib/config";
import {
  STATUS,
  ZERO_ADDRESS,
  docketRef,
  formatGen,
  relativeDeadline,
  shortAddress,
  thresholdPercent,
} from "@/lib/docket";
import { getDocket } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

export default async function DocketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docketId = Number(id);
  if (!Number.isInteger(docketId) || docketId < 0) notFound();

  let docket;
  try {
    docket = await getDocket(docketId);
  } catch {
    notFound();
  }

  const deadlinePassed = Number(docket.deadline) * 1000 < Date.now();

  return (
    <div className="shell shell-narrow">
      <div className="docket-id mono">{docketRef(docketId)}</div>
      <h1>{docket.sow_text}</h1>

      <div className="detail-head">
        <StatusChip status={docket.status} />
        <span className="muted mono">{relativeDeadline(docket.deadline)}</span>
      </div>

      <div className="panel">
        <h2>Scope of work</h2>
        <p className="pre-wrap">{docket.sow_text}</p>
      </div>

      <div className="panel">
        <h2>Acceptance criteria</h2>
        <p className="hint muted">
          This is what validators check the deliverable against. Being specific here is the
          single biggest factor in whether adjudication goes the way you expect.
        </p>
        <p className="pre-wrap">{docket.acceptance_criteria}</p>
      </div>

      <div className="panel">
        <h2>Escrow record</h2>
        <div className="kv">
          <span className="k">Amount escrowed</span>
          <span className="v">{formatGen(docket.amount)}</span>
        </div>
        <div className="kv">
          <span className="k">Partial-release threshold</span>
          <span className="v">
            {thresholdPercent(docket.threshold_bp).toFixed(0)} / 100 compliance
          </span>
        </div>
        <div className="kv">
          <span className="k">Deadline</span>
          <span className="v">
            {new Date(Number(docket.deadline) * 1000).toISOString().replace("T", " ").slice(0, 16)}
            {deadlinePassed ? " · passed" : ""}
          </span>
        </div>
        <div className="kv">
          <span className="k">Client</span>
          <span className="v">{shortAddress(docket.client)}</span>
        </div>
        <div className="kv">
          <span className="k">Worker</span>
          <span className="v">
            {docket.worker === ZERO_ADDRESS ? "unclaimed" : shortAddress(docket.worker)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Posted</span>
          <span className="v">
            {new Date(Number(docket.created_at) * 1000).toISOString().replace("T", " ").slice(0, 16)}
          </span>
        </div>
      </div>

      {docket.evidence.length > 0 ? (
        <div className="panel">
          <h2>Submitted evidence</h2>
          <p className="hint muted">
            Validators fetch these URLs themselves during adjudication rather than trusting a
            description. Read them yourself before disputing.
          </p>
          <ul className="evidence-list">
            {docket.evidence.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer noopener">
                  {url}
                </a>
              </li>
            ))}
          </ul>
          {docket.note ? (
            <div className="kv">
              <span className="k">Worker&apos;s note</span>
              <span className="v note">{docket.note}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {docket.status === STATUS.CLOSED || docket.status === STATUS.EXPIRED ? (
        <div className="panel">
          <p className="muted">
            This docket is closed.{" "}
            <Link href={`/docket/${docketId}/result`}>See the settlement record</Link>.
          </p>
        </div>
      ) : (
        <DocketActions docketId={docketId} status={docket.status} deadlinePassed={deadlinePassed} />
      )}

      <p className="muted mono contract-note">
        Contract <Link href={network.explorerAddressUrl(CONTRACT_ADDRESS)}>{CONTRACT_ADDRESS}</Link>
      </p>
    </div>
  );
}