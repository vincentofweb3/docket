import { notFound } from "next/navigation";
import { averageScore, getReputation } from "@/lib/reputation";
import { getDocket } from "@/lib/genlayer";
import { shortAddress } from "@/lib/docket";

export const dynamic = "force-dynamic";

/**
 * Read-only reputation for any address. Needs no wallet — the whole point of an on-chain
 * reputation ledger is that it is public.
 */
export default async function ReputationPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) notFound();

  let rep;
  try {
    rep = await getReputation(address);
  } catch {
    notFound();
  }

  const avg = averageScore(rep);

  return (
    <div className="shell shell-narrow">
      <div className="eyebrow">Reputation</div>
      <h1 className="mono" style={{ fontSize: 26, wordBreak: "break-all" }}>
        {shortAddress(address, 10, 8)}
      </h1>
      <p className="lede">
        Written by the contract itself as dockets resolve. Read-only, and readable by any
        address or future identity system - nobody can edit it.
      </p>

      <div className="panel">
        <h2>Record</h2>
        <div className="kv">
          <span className="k">Dockets completed</span>
          <span className="v">{rep.completed}</span>
        </div>
        <div className="kv">
          <span className="k">Disputed</span>
          <span className="v">{rep.disputed}</span>
        </div>
        <div className="kv">
          <span className="k">Upheld in dispute</span>
          <span className="v">{rep.upheld}</span>
        </div>
        <div className="kv">
          <span className="k">Average compliance score</span>
          <span className="v">{avg == null ? "—" : `${avg.toFixed(1)} / 100`}</span>
        </div>
        <div className="kv">
          <span className="k">Address</span>
          <span className="v">{address}</span>
        </div>
      </div>

      <p className="muted">
        A high dispute count is not automatically bad: on the client side a dispute means the
        worker&apos;s delivery was genuinely contested. What matters is whether the verdict
        upheld.
      </p>
    </div>
  );
}
