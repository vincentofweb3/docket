import Link from "next/link";
import "../landing.css";
import "./how-it-works.css";
import { NetworkLimits } from "@/components/NetworkLimits";
import { network } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Orientation page linked from the nav. Written as the three real jobs a person can do here —
 * post, claim/deliver, accept or dispute — with the exact fields each screen expects, because
 * "how it works" is most useful as "what to type".
 */
export default function HowItWorksPage() {
  return (
    <>
      <section className="hero how-hero">
        <div className="eyebrow">How it works</div>
        <h1>Post work, deliver against a written scope, and let consensus settle it.</h1>
        <p className="lede">
          Docket holds a payment in escrow and writes the scope of work in plain language. If both
          sides agree, it settles immediately. If they don&apos;t, AI validators fetch the same
          evidence and decide. Either way neither party gets to be the sole judge.
        </p>
      </section>

      <section className="section how">
        <div className="section-head">
          <div className="eyebrow">The whole flow</div>
          <h2>Five steps, two of which need a wallet.</h2>
        </div>
        <ol className="flow">
          <li>
            <span className="flow-n mono">01</span>
            <div>
              <h3>Post a docket and escrow the payment</h3>
              <p>
                You write the scope and the acceptance criteria, set a threshold and a deadline,
                and attach the payment. That contract record is the thing validators judge
                against later. <Link href="/dockets/new">Post a docket &rarr;</Link>
              </p>
            </div>
          </li>
          <li>
            <span className="flow-n mono">02</span>
            <div>
              <h3>A worker claims it</h3>
              <p>
                Anyone but you can claim an open docket. Claiming is permissionless and starts the
                clock on delivery. <Link href="/register">Browse the register &rarr;</Link>
              </p>
            </div>
          </li>
          <li>
            <span className="flow-n mono">03</span>
            <div>
              <h3>They submit evidence URLs</h3>
              <p>
                The deliverable is public links - a deployed endpoint, a published document, a
                repository - not a description. Validators fetch these themselves rather than
                taking anyone&apos;s word. <Link href="/my-dockets">Track it as the worker &rarr;</Link>
              </p>
            </div>
          </li>
          <li>
            <span className="flow-n mono">04</span>
            <div>
              <h3>You accept, or you dispute</h3>
              <p>
                Accepting releases the escrow straight away. Disputing hands the decision to
                validators, who produce a verdict, a 0–100 compliance score, and the specific
                criteria they found unmet.
              </p>
            </div>
          </li>
          <li>
            <span className="flow-n mono">05</span>
            <div>
              <h3>The escrow settles from the verdict</h3>
              <p>
                <strong>Full</strong> pays the worker everything. <strong>Partial</strong> pays
                the score as a percentage - unless it falls below your threshold, in which case it
                refunds in full. <strong>Reject</strong> refunds the client in full. If the
                deadline passes with no deliverable, anyone can refund the escrow.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="section how">
        <div className="section-head">
          <div className="eyebrow">Writing the scope</div>
          <h2>The acceptance criteria decide almost everything.</h2>
          <p className="lede">
            Validators read the same text you wrote. Vague criteria produce verdicts that surprise
            you, disputes you didn&apos;t intend, and escrow released against a standard nobody
            agreed to. Write each criterion so that a stranger could check it.
          </p>
        </div>
        <div className="panel">
          <h3>A scope that adjudicates cleanly</h3>
          <p className="pre-wrap">
            Publish an implementation guide for the HTTP/1.1 specification{"\n"}- Must cite the
            published RFC as an https URL{"\n"}- Must be guidance, not a copy of the
            specification{"\n"}- Must cover connection management and message framing
          </p>
          <h3 style={{ marginTop: 20 }}>One that will not</h3>
          <p className="pre-wrap">
            Write about HTTP{"\n"}- Should be good quality{"\n"}- Reasonable length
          </p>
          <p className="hint muted">
            The second version cannot be checked. Validators will rule on taste, and the docket
            becomes a coin flip between the two of you.
          </p>
        </div>
      </section>

      <section className="section how">
        <div className="section-head">
          <div className="eyebrow">What a worker needs to know</div>
          <h2>Claiming and delivering</h2>
        </div>
        <div className="steps-grid">
          <div className="step">
            <span className="step-n mono">For a worker</span>
            <h3>Find work</h3>
            <p>
              The register lists every open docket with its escrow and deadline, sorted by how soon
              it closes.
            </p>
          </div>
          <div className="step">
            <span className="step-n mono">For a worker</span>
            <h3>Claim, then deliver</h3>
            <p>
              Claiming assigns the docket to you. Then submit evidence URLs plus an optional note.
              The note is context for the client, not evidence — validators judge the links.
            </p>
          </div>
          <div className="step">
            <span className="step-n mono">For a client</span>
            <h3>Review the links</h3>
            <p>
              Open the submitted URLs yourself before accepting or disputing. They are the same
              URLs validators will fetch.
            </p>
          </div>
        </div>
        <div className="capability-note" style={{ marginTop: 26 }}>
          <strong>Disputing starts real AI adjudication</strong>
          It typically takes several minutes while validators fetch evidence and vote. That wait is
          the product working, not something stuck — the docket page shows each stage of the
          transaction lifecycle as it happens.
        </div>
      </section>

      <section className="section how">
        <div className="section-head">
          <div className="eyebrow">Before you start</div>
          <h2>What you need, and what this network can do.</h2>
        </div>
        <div className="steps-grid">
          <div className="step">
            <span className="step-n mono">Reading</span>
            <h3>No wallet needed</h3>
            <p>
              Every docket, escrow figure and verdict is public chain state. You can audit this
              entire contract without connecting anything.
            </p>
          </div>
          <div className="step">
            <span className="step-n mono">Writing</span>
            <h3>A wallet is needed</h3>
            <p>
              Posting, claiming, submitting, accepting and disputing all require a connected
              GenLayer-enabled wallet. <Link href="/connect-wallet">Connect one &rarr;</Link>
            </p>
          </div>
          <div className="step">
            <span className="step-n mono">Reputation</span>
            <h3>Yours is public</h3>
            <p>
              Every resolved docket updates a reputation record for both parties, readable by
              anyone at <Link href="/reputation">any address &rarr;</Link>.
            </p>
          </div>
        </div>
        <div style={{ marginTop: 26 }}>
          <NetworkLimits />
        </div>
        <p className="muted">
          Appeals are a native GenLayer mechanism rather than a Docket feature.{" "}
          <Link href="/appeal-guide">What is and isn&apos;t available on {network.label} &rarr;</Link>
        </p>
      </section>
    </>
  );
}
