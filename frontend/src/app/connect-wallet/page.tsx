import { WalletConnect } from "@/components/WalletConnect";
import "@/components/tx.css";
import { network } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function ConnectWalletPage() {
  return (
    <div className="shell shell-narrow">
      <div className="eyebrow">Account</div>
      <h1>Connect a wallet</h1>
      <p className="lede">
        Reading Docket needs nothing. Every docket, escrow and verdict is public chain state —
        you can audit this contract without connecting anything. A wallet is only needed to act.
      </p>
      <div style={{ height: 20 }} />
      <WalletConnect />
      <div className="panel">
        <h2>About {network.label}</h2>
        <p className="muted">
          This build reads and writes against {network.label}, GenLayer&apos;s public test network.
          It is gasless: transactions cost no GEN, though escrowed GEN can still be posted as
          stake.
        </p>
        <p className="muted">
          Network capability differs by chain. On {network.label} an emitted escrow payout does
          not credit a recipient wallet, and appeals are unavailable — both are network
          limitations, recorded with evidence in the project repository.
        </p>
      </div>
    </div>
  );
}
