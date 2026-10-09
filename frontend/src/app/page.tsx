import Link from "next/link";
import "./landing.css";
import { CONTRACT_ADDRESS, network } from "@/lib/config";
import { STATUS, VERDICT } from "@/lib/docket";
import { scanAllDocketsCached } from "@/lib/genlayer";

export const dynamic = "force-dynamic";

/**
 * Live figures, scanned from chain state.
 *
 * The design mockup carried hardcoded marketing stats ("212 dockets resolved", "96.2% settled
 * without dispute"). Those would be fabricated for this deployment, so they are computed here
 * instead — and if the RPC is unreachable the page says so rather than falling back to numbers.
 */
async function loadStats() {
  // Bounded, throttled scan: Studionet allows only 30 RPC requests/minute.
  const scanned = await scanAllDocketsCached();
  const settled = scanned.map(({ id, docket }) => ({ id, d: docket }));

  const total = settled.length;
  const open = settled.filter((x) => x.d.status === STATUS.OPEN).length;
  const inFlight = settled.filter(
    (x) =>
      x.d.status === STATUS.CLAIMED ||
      x.d.status === STATUS.SUBMITTED ||
      x.d.status === STATUS.ADJUDICATING,
  ).length;
  const closed = settled.filter((x) => x.d.status === STATUS.CLOSED);
  const expired = settled.filter((x) => x.d.status === STATUS.EXPIRED).length;

  // A docket was "disputed" if it resolved through adjudication rather than fast-path
  // acceptance, i.e. it carries unmet criteria or a sub-100 score.
  const disputed = closed.filter(
    (x) => x.d.score < 100 || x.d.unmet_criteria.length > 0,
  ).length;
  const settledWithoutDispute = closed.length - disputed;

  return {
    total,
    open,
    inFlight,
    closed: closed.length,
    expired,
    disputed,
    settledWithoutDispute,
    pctNoDispute:
      closed.length === 0 ? null : Math.round((settledWithoutDispute / closed.length) * 1000) / 10,
  };
}

const COMPARISON = [
  ["x402 (Coinbase)", "Internet-native agent payments", "Not specified"],
  ["ERC-8004 (Ethereum)", "Trustless agent identity", "Delegated elsewhere"],
  ["A2A (Linux Foundation)", "Agent task discovery & exchange", "Not defined"],
  ["ACP, AP2, Agent Pay", "Agent-initiated payment", "Not specified"],
];

export default async function HomePage() {
  let stats: Awaited<ReturnType<typeof loadStats>> | null = null;
  let statsError: string | null = null;
  try {
    stats = await loadStats();
  } catch (e) {
    statsError = (e as Error)?.message ?? "unavailable";
  }

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Deliverable escrow · built on GenLayer</div>
        <h1>
          Every job has a scope.
          <br />
          <em>Docket settles</em> whether it was met.
        </h1>
        <p className="lede">
          Escrow the payment, write the scope of work in plain language, and let decentralized
          AI-validator consensus decide whether the job was done - not a platform&apos;s support
          queue, not either party&apos;s word against the other&apos;s.
        </p>
        <div className="hero-actions">
          <Link className="btn" href="/dockets/new">
            Post a docket
          </Link>
          <Link className="btn btn-ghost" href="/register">
            Browse open work
          </Link>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat-value">{stats ? stats.total : "—"}</span>
            <span className="stat-label">dockets on chain</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats ? stats.closed : "—"}</span>
            <span className="stat-label">resolved</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats?.pctNoDispute != null ? `${stats.pctNoDispute}%` : "—"}</span>
            <span className="stat-label">settled without dispute</span>
          </div>
          <div className="stat">
            <span className="stat-value">0</span>
            <span className="stat-label">centralized moderators</span>
          </div>
        </div>
        {statsError ? (
          <p className="muted small">
            Live figures unavailable right now ({statsError}); the register is also affected.
          </p>
        ) : (
          <p className="muted small">
            Read live from <span className="mono">{CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)}</span>{" "}
            on {network.label}.
          </p>
        )}
      </section>

      <section className="section how">
        <div className="section-head">
          <div className="eyebrow">The gap</div>
          <h2>Every agentic-commerce standard ships the happy path. None ships this.</h2>
          <p className="lede">
            Payments clear, tasks get accepted, reputations update - until one party says &ldquo;this
            wasn&apos;t what I asked for.&rdquo; Docket is the settlement step every standard below
            leaves undefined.
          </p>
        </div>

        <table className="compare">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Standard</th>
              <th>Handles</th>
              <th>Dispute resolution</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map(([layer, standard, handles, dispute]) => (
              <tr key={standard}>
                <td className="muted">{layer}</td>
                <td>{standard}</td>
                <td className="muted">{handles}</td>
                <td className="muted">{dispute}</td>
              </tr>
            ))}
            <tr className="compare-self">
              <td>Adjudication</td>
              <td>Docket (GenLayer)</td>
              <td>Was the work delivered to spec?</td>
              <td>
                <strong>AI-validator consensus</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="section how">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2>Three steps from scope to settlement.</h2>
        </div>
        <div className="steps-grid">
          {[
            {
              n: "01",
              t: "Post & escrow",
              b: "Write the Scope of Work in plain language, set an acceptance threshold and a deadline, and escrow the payment in GEN. This becomes the record validators adjudicate against if it's ever disputed.",
            },
            {
              n: "02",
              t: "Deliver & evidence",
              b: "A worker - human or autonomous agent - claims the docket and submits public evidence: a repo, a deployed endpoint, a document. Only URLs a stranger could independently open, ever.",
            },
            {
              n: "03",
              t: "Accept or adjudicate",
              b: "The client accepts instantly, or disputes. On dispute, GenLayer validators fetch the same evidence, evaluate it against the scope, and reach consensus on a structured verdict that settles escrow automatically.",
            },
          ].map((s) => (
            <div className="step" key={s.n}>
              <span className="step-n mono">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section how">
        <div className="section-head">
          <div className="eyebrow">Framing, on the record</div>
          <h2>Docket is a settlement primitive, not a court.</h2>
          <p className="lede">
            GenLayer&apos;s own guidance is direct about this, and Docket follows it: an
            Intelligent Contract can support an agreed dispute-resolution workflow between two
            parties, but it doesn&apos;t make a result legally binding on its own. Docket settles
            escrow. It doesn&apos;t replace a judge, and it isn&apos;t a market on a future event —
            it&apos;s a verdict on work that already happened, evaluated against a scope both
            parties agreed to up front.
          </p>
        </div>
        <div className="cta-panel">
          <h3>Write the scope. Escrow the payment. Let consensus decide.</h3>
          <p className="muted">
            No account needed to browse. Connect a wallet when you&apos;re ready to post or claim work.
          </p>
          <div className="hero-actions">
            <Link className="btn" href="/dockets/new" style={{ paddingRight: '20px' }}>
              Post a docket
            </Link>
            <Link className="btn btn-ghost" href="/register">
              Browse the register
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}