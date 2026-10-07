import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitDeliverableForm } from "@/components/SubmitDeliverableForm";
import { docketRef, formatGen, thresholdPercent } from "@/lib/docket";
import { getDocket } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

export default async function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docketId = Number(id);
  if (!Number.isInteger(docketId) || docketId < 0) notFound();

  const docket = await getDocket(docketId).catch(() => null);
  if (!docket) notFound();

  return (
    <div className="shell shell-narrow">
      <div className="docket-id mono">{docketRef(docketId)}</div>
      <h1>Submit a deliverable</h1>

      <div className="panel">
        <h2>What you&apos;re delivering against</h2>
        <div className="kv">
          <span className="k">Scope</span>
          <span className="v" style={{ fontFamily: "var(--font-body)", textAlign: "left" }}>
            {docket.sow_text}
          </span>
        </div>
        <div className="kv">
          <span className="k">Partial-release threshold</span>
          <span className="v">{thresholdPercent(docket.threshold_bp).toFixed(0)} / 100</span>
        </div>
        <div className="kv">
          <span className="k">Escrow on the line</span>
          <span className="v">{formatGen(docket.amount)}</span>
        </div>
      </div>

      <div className="panel">
        <h2>Acceptance criteria</h2>
        <p className="pre-wrap">{docket.acceptance_criteria}</p>
      </div>

      <SubmitDeliverableForm docketId={docketId} />

      <p className="muted">
        <Link href={`/docket/${docketId}`}>Back to the docket</Link>
      </p>
    </div>
  );
}