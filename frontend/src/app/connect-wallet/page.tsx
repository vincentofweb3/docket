"use client";

import Link from "next/link";
import "@/components/tx.css";
import { network } from "@/lib/config";
import { shortAccount, useWallet } from "@/lib/wallet-context";

export default function ConnectWalletPage() {
  const { hasWallet, account, connecting, error, connect, disconnect } = useWallet();

  return (
    <div className="shell shell-narrow">
      <div className="eyebrow">Account</div>
      <h1>Connect a wallet</h1>
      <p className="lede">
        Reading Docket needs nothing. Every docket, escrow figure and verdict is public chain state
        — you can audit this contract without connecting anything. A wallet is only needed to act.
      </p>

      <div style={{ height: 20 }} />

      {hasWallet === null ? (
        <div className="panel">
          <p className="muted">Checking for an installed wallet…</p>
        </div>
      ) : !hasWallet ? (
        <div className="wallet-gate">
          <h3>No GenLayer wallet detected</h3>
          <p>
            Reading dockets, escrow and verdicts needs no wallet at all — every record is public.
            Posting, claiming, submitting and resolving require a GenLayer-enabled wallet, which
            currently means MetaMask with the GenLayer Snap installed.
          </p>
          <p className="muted">
            This app talks to an injected EIP-1193 provider on <strong>{network.label}</strong>.
          </p>
        </div>
      ) : account ? (
        <div className="panel">
          <h2>Wallet connected</h2>
          <div className="kv">
            <span className="k">Address</span>
            <span className="v">{account}</span>
          </div>
          <div className="kv">
            <span className="k">Network</span>
            <span className="v">{network.label}</span>
          </div>
          <p className="muted">
            Your dockets are on the <Link href="/my-dockets">My Dockets</Link> page, split by
            whether you posted or claimed each one.
          </p>
          <button className="btn btn-ghost" onClick={disconnect}>
            Disconnect {shortAccount(account)}
          </button>
        </div>
      ) : (
        <div className="panel">
          <h2>Connect a wallet</h2>
          <p className="muted">
            A wallet is needed only to act — posting, claiming, submitting, accepting or
            disputing. Everything else on this site reads public chain state.
          </p>
          <button className="btn" onClick={connect} disabled={connecting}>
            {connecting ? "Waiting for wallet…" : "Connect wallet"}
          </button>
          {error ? <p className="field-error">{error}</p> : null}
        </div>
      )}

      <div className="panel">
        <h2>About {network.label}</h2>
        <p className="muted">
          This build reads and writes against {network.label}, GenLayer&apos;s public test network.
          It is gasless: transactions cost no GEN, though escrowed GEN can still be posted as
          stake.
        </p>
        <p className="muted">
          Network capability differs by chain. On {network.label} an emitted escrow payout does not
          credit a recipient wallet, and appeals are unavailable — both are network limitations,
          recorded with evidence in the project repository.
        </p>
      </div>
    </div>
  );
}
