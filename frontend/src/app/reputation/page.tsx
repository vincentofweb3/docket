import Link from "next/link";
import { shortAddress } from "@/lib/docket";
import { currentAccountHint } from "./reputation-lookup";

export const dynamic = "force-dynamic";

/**
 * Reputation is a read of an address, so the root needs an address to read. Show the connected
 * wallet's own record when there is one, otherwise explain how to look one up — never guess.
 */
export default async function ReputationIndexPage() {
  const hint = await currentAccountHint();

  return (
    <div className="shell shell-narrow">
      <div className="eyebrow">Reputation</div>
      <h1>Reputation</h1>
      <p className="lede">
        Every resolved docket updates an on-chain reputation record for both parties. It is written
        by the contract, readable by anyone, and editable by nobody.
      </p>

      <div className="panel">
        {hint ? (
          <>
            <h2>Your record</h2>
            <div className="kv">
              <span className="k">Address</span>
              <span className="v">{hint.address}</span>
            </div>
            <p style={{ marginTop: 16 }}>
              <Link className="btn" href={`/reputation/${hint.address}`}>
                View {shortAddress(hint.address)} &rarr;
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2>Look up an address</h2>
            <p className="muted">
              Open <span className="mono">/reputation/0x…</span> with the address you want to
              inspect. No wallet is required — the record is public chain state.
            </p>
            <p className="muted">
              <Link href="/connect-wallet">Connect a wallet</Link> to see your own record here, or
              browse <Link href="/my-dockets">My Dockets</Link>.
            </p>
          </>
        )}
      </div>

      <p className="muted">
        A high dispute count is not automatically bad. On the client side a dispute means the
        worker&apos;s delivery was genuinely contested; what matters is whether the verdict upheld
        them.
      </p>
    </div>
  );
}
