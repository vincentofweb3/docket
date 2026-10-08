import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
// Global stylesheets must be imported from the app root in the App Router.
import "@/components/tx.css";
import "@/components/seal.css";
import { network } from "@/lib/config";

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
        <header className="site-header">
          <Link className="wordmark" href="/">
            Docket<span>.</span>
          </Link>
          <nav className="site-nav">
            <Link href="/register">The Register</Link>
            <Link href="/dockets/new">Post a Docket</Link>
            <Link href="/my-dockets">My Dockets</Link>
            <Link href="/appeal-guide">Appeals</Link>
            <Link className="nav-cta" href="/connect-wallet">
              Connect wallet
            </Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <span>
            Docket is an independent open-source project built on GenLayer. It is not a legal
            arbitrator - read the scope of work before posting or claiming. Live on{" "}
            <strong>{network.label}</strong>.
          </span>
          <span className="mono">
            <Link href="https://github.com/vincentofweb3/docket">github</Link> ·{" "}
            <Link href={network.explorerAddressUrl("0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B")}>
              explorer
            </Link>
          </span>
        </footer>
      </body>
    </html>
  );
}