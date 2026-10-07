import Link from "next/link";
import { StatusChip } from "@/components/StatusChip";
import "./register.css";
import { CONTRACT_ADDRESS, network } from "@/lib/config";
import { docketRef, formatGen, relativeDeadline, type Docket } from "@/lib/docket";
import { listOpenDockets, getDocket } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

type Entry = { id: number; docket: Docket };

/**
 * The register: every open docket on the active network, read straight from chain.
 *
 * Fails loudly rather than showing a fabricated list — a register that silently shows demo rows
 * when the RPC is down would misrepresent the contract's actual state.
 */
async function loadOpenDockets(): Promise<{ entries: Entry[]; error: string | null }> {
  try {
    const ids = await listOpenDockets();
    const entries = await Promise.all(
      ids.map(async (id) => ({ id, docket: await getDocket(id) })),
    );
    // Sort by deadline, but carry the on-chain id alongside — the array index is NOT the id.
    entries.sort((a, b) => Number(a.docket.deadline - b.docket.deadline));
    return { entries, error: null };
  } catch (err) {
    return { entries: [], error: (err as Error)?.message ?? "Unknown RPC failure" };
  }
}

export default async function RegisterPage() {
  const { entries, error } = await loadOpenDockets();

  return (
    <>
      <section className="shell register-hero">
        <div className="eyebrow">Deliverable escrow · {network.label}</div>
        <h1>Every job has a scope. Docket settles whether it was met.</h1>
        <p className="lede">
          Escrow the payment, write the scope of work in plain language, and let decentralized
          AI-validator consensus — not a platform, not either party — decide whether the job was
          done. This register is read live from the contract at{" "}
          <Link href={network.explorerAddressUrl(CONTRACT_ADDRESS)} className="mono">
            {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)}
          </Link>
          .
        </p>
        <div className="hero-actions">
          <Link className="btn" href="/dockets/new">
            Post a docket
          </Link>
          <Link className="btn btn-ghost" href="/my-dockets">
            My dockets
          </Link>
        </div>
      </section>

      <section className="shell">
        <div className="register-head">
          <h2>Open Register</h2>
          <span className="count">
{error ? "unavailable" : `${entries.length} open · read from chain`}
          </span>
        </div>

        {error ? (
          <div className="error-banner">
            <span className="error-icon" aria-hidden>
              !
            </span>
            <div>
              <h4>Couldn&apos;t read the register</h4>
              <p>
                The contract at {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)} on{" "}
                {network.label} didn&apos;t respond: <code>{error}</code>. No rows are shown,
                because showing sample rows here would misrepresent what is actually escrowed.
              </p>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty">
            <h3>No open dockets</h3>
            <p>
              Every docket on {network.label} is either claimed, in adjudication, or resolved.
              Post the first one.
            </p>
            <Link className="btn" href="/dockets/new">
              Post a docket
            </Link>
          </div>
        ) : (
          entries.map(({ id, docket: d }) => (
            <Link key={id} className="register-row" href={`/docket/${id}`}>
              <div className="docket-id">{docketRef(id)}</div>
              <div>
                <p className="row-title">{d.sow_text}</p>
                <p className="row-sub">{d.acceptance_criteria.split("\n")[0]}</p>
              </div>
              <div>
                <StatusChip status={d.status} />
              </div>
              <div className="amount">{formatGen(d.amount)}</div>
              <div className="deadline">{relativeDeadline(d.deadline)}</div>
            </Link>
          ))
        )}
      </section>
    </>
  );
}