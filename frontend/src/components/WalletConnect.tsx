"use client";

import { useEffect, useState } from "react";
import { currentAccount, detectInjectedProvider } from "@/lib/wallet";
import { network } from "@/lib/config";

export function WalletConnect() {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasWallet(Boolean(detectInjectedProvider()));
    currentAccount().then(setAccount);
  }, []);

  const connect = async () => {
    const provider = detectInjectedProvider();
    if (!provider) return;
    setBusy(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(accounts?.[0] ?? null);
    } catch {
      setError("The wallet declined the connection request.");
    } finally {
      setBusy(false);
    }
  };

  if (hasWallet === null) return null;

  if (!hasWallet) {
    return (
      <div className="wallet-gate">
        <h3>No GenLayer wallet detected</h3>
        <p>
          Reading dockets, escrow and verdicts needs no wallet at all - every record is public.
          Posting, claiming, submitting and resolving need a GenLayer-enabled wallet, which
          currently means MetaMask with the GenLayer Snap installed.
        </p>
        <p className="muted">
          This app talks to an injected EIP-1193 provider on <strong>{network.label}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      {account ? (
        <>
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
            Your dockets are on the <a href="/my-dockets">My Dockets</a> page, split by whether
            you posted or claimed each one.
          </p>
        </>
      ) : (
        <>
          <h2>Connect a wallet</h2>
          <p className="muted">
            A wallet is needed only to act - posting, claiming, submitting, accepting or
            disputing. Everything on this site reads public chain state.
          </p>
          <button className="btn" onClick={connect} disabled={busy}>
            {busy ? "Waiting for wallet…" : "Connect wallet"}
          </button>
          {error ? <p className="field-error">{error}</p> : null}
        </>
      )}
    </div>
  );
}