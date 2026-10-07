import { MyDockets } from "@/components/MyDockets";
import "@/components/tx.css";

export const dynamic = "force-dynamic";

/**
 * The contract exposes no index-by-address read, so this page cannot enumerate a wallet's
 * dockets from chain state alone. It resolves the connected account and scans a bounded range
 * of docket ids instead — honest about being a scan, and bounded so it stays cheap.
 */
export default function MyDocketsPage() {
  return (
    <div className="shell">
      <div className="eyebrow">Account</div>
      <h1>My dockets</h1>
      <p className="lede">
        Split by role, because the actions available to you are entirely different on each side.
      </p>
      <div style={{ height: 20 }} />
      <MyDockets />
    </div>
  );
}
