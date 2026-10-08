"use client";

import Link from "next/link";
import { shortAccount, useWallet } from "@/lib/wallet-context";

/**
 * Nav wallet control. Disconnected it is a white "Connect wallet" button; connected it shows the
 * short address with a Disconnect affordance beside it, so a user who connected for one task is
 * never stuck attached to it.
 */
export function WalletButton() {
  const { hasWallet, account, connecting, connect, disconnect } = useWallet();

  // Nothing to offer until we know whether a wallet exists at all.
  if (hasWallet === false) {
    return (
      <Link className="nav-cta" href="/connect-wallet">
        Connect wallet
      </Link>
    );
  }
  if (hasWallet === null) return <span className="nav-cta" aria-hidden />;

  if (!account) {
    return (
      <button className="nav-cta" onClick={connect} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <span className="nav-cta connected">
      <span className="addr" title={account}>
        {shortAccount(account)}
      </span>
      <button
        className="disconnect"
        onClick={disconnect}
        title={`Disconnect ${account}`}
        aria-label={`Disconnect wallet ${account}`}
      >
        Disconnect
      </button>
    </span>
  );
}
