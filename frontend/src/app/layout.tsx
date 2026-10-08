import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
// Global stylesheets must be imported from the app root in the App Router.
import "@/components/tx.css";
import "@/components/seal.css";
import { WalletProvider } from "@/lib/wallet-context";
import { WalletButton } from "@/components/WalletButton";
import { CONTRACT_ADDRESS, network } from "@/lib/config";

/**
 * Explicit viewport. Next supplies a default, but this app reflows at 980/700/520/360px and
 * states the intent rather than relying on it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Docket — deliverable escrow and spec-compliance adjudication",
  description:
    "Escrow the payment, write the scope of work in plain language, and let decentralized " +
    "AI-validator consensus decide whether the job was done.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <header className="site-header">
            <Link className="wordmark" href="/">
              Docket<span>.</span>
            </Link>
            <nav className="site-nav">
              <Link href="/register">The Register</Link>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/dockets/new">Post a Docket</Link>
              <Link href="/my-dockets">My Dockets</Link>
              <Link href="/appeal-guide">Appeals</Link>
              <WalletButton />
            </nav>
          </header>
          {children}
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}

const REPO_URL = "https://github.com/vincentofweb3/docket";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <div className="wordmark footer-mark">
          Docket<span>.</span>
        </div>
        <p className="footer-tagline">
          Deliverable escrow and spec-compliance adjudication, settled by AI-validator consensus
          on GenLayer.
        </p>
        <p className="footer-note">
          Docket is an independent open-source project. It is not a legal arbitrator and does not
          make a result binding outside the escrow it settles — read the scope of work before
          posting or claiming.
        </p>
      </div>

      <nav className="footer-col" aria-label="Product">
        <h2>Product</h2>
        <Link href="/register">The Register</Link>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/dockets/new">Post a Docket</Link>
        <Link href="/my-dockets">My Dockets</Link>
        <Link href="/reputation">Reputation</Link>
      </nav>

      <nav className="footer-col" aria-label="Learn">
        <h2>Learn</h2>
        <Link href="/appeal-guide">Appeals</Link>
        <Link href="/connect-wallet">Connect a wallet</Link>
        <Link href={network.explorerAddressUrl(CONTRACT_ADDRESS)}>Deployed contract</Link>
        <a href={network.explorerTxUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer noopener">
          Explorer
        </a>
      </nav>

      <nav className="footer-col" aria-label="Project">
        <h2>Project</h2>
        <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
          Source code
        </a>
        <a href={`${REPO_URL}/blob/master/docs/09-submission-and-review-readiness.md`} target="_blank" rel="noreferrer noopener">
          Evidence checklist
        </a>
        <a href={`${REPO_URL}/blob/master/AUDIT_HANDOFF.md`} target="_blank" rel="noreferrer noopener">
          Verification log
        </a>
        <span className="footer-live">
          Live on <strong>{network.label}</strong>
        </span>
      </nav>

      <div className="footer-base">
        <span className="mono">MIT licensed</span>
        <span className="mono">
          Contract <Link href={network.explorerAddressUrl(CONTRACT_ADDRESS)}>{CONTRACT_ADDRESS}</Link>
        </span>
      </div>
    </footer>
  );
}
