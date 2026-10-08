"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import { STATUS_LABEL, docketRef, formatGen, relativeDeadline, type Docket } from "@/lib/docket";

/** Docket as it arrives over JSON, with BigInt fields as decimal strings. */
type WireDocket = Omit<Docket, "amount" | "deadline" | "created_at" | "resolved_at"> & {
  amount: string;
  deadline: string;
  created_at: string;
  resolved_at: string;
};

const fromWire = (d: WireDocket): Docket => ({
  ...d,
  amount: BigInt(d.amount),
  deadline: BigInt(d.deadline),
  created_at: BigInt(d.created_at),
  resolved_at: BigInt(d.resolved_at),
});

type Row = { id: number; docket: Docket; role: "client" | "worker" };

export function MyDockets() {
  const { hasWallet, account, connect } = useWallet();
  const [rows, setRows] = useState<Row[]>([]);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<"client" | "worker">("client");
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    (async () => {
      setScanning(true);
      setError(null);
      try {
        // Ids are sequential, so a bounded throttled scan finds dockets involving this
        // address. The contract has no index-by-address read, and Studionet allows only 30 RPC
        // requests/minute, so this is explicitly a recent-window scan.
        const me = account.toLowerCase();
        const res = await fetch("/api/dockets/scan");
        if (!res.ok) throw new Error((await res.json()).error ?? "scan failed");
        const { dockets } = (await res.json()) as {
          dockets: { id: number; docket: WireDocket }[];
        };
        const found: Row[] = [];
        for (const { id, docket } of dockets) {
          if (docket.client?.toLowerCase() === me) found.push({ id, docket: fromWire(docket), role: "client" });
          else if (docket.worker?.toLowerCase() === me) found.push({ id, docket: fromWire(docket), role: "worker" });
        }
        if (!cancelled) setRows(found);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? "Scan failed");
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account]);

  const visible = useMemo(() => {
    const ACTIVE = new Set([0, 1, 2, 3, 4]);
    return rows.filter(
      (r) => r.role === tab && (filter === "all" || ACTIVE.has(r.docket.status)),
    );
  }, [rows, tab, filter]);

  if (hasWallet === null) return null;

  if (!hasWallet) {
    return (
      <div className="wallet-gate">
        <h3>Connect a wallet to see your dockets</h3>
        <p>
          This page filters the chain by your address, so it needs one. Every docket is still
          readable without a wallet from the register.
        </p>
        <Link className="btn" href="/connect-wallet">
          Connect wallet
        </Link>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="panel">
        <p className="muted">
          Connect a wallet on the <Link href="/connect-wallet">connect page</Link> to see the
          dockets where you are the client or the worker.
        </p>
      </div>
    );
  }

  const clientCount = rows.filter((r) => r.role === "client").length;
  const workerCount = rows.filter((r) => r.role === "worker").length;

  return (
    <>
      <div className="tabs">
        {(["client", "worker"] as const).map((t) => (
          <button
            key={t}
            className={`tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            As {t} ({t === "client" ? clientCount : workerCount})
          </button>
        ))}
      </div>

      <div className="filter-row">
        {(["active", "all"] as const).map((f) => (
          <button
            key={f}
            className={`chip-btn${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "active" ? "Active" : "All"}
          </button>
        ))}
      </div>

      <p className="muted small">
        Address <span className="mono">{account}</span>
        {scanning ? " · scanning recent docket ids…" : ` · ${rows.length} match in the scanned window`}
      </p>

      {error ? (
        <div className="error-banner">
          <span className="error-icon" aria-hidden>
            !
          </span>
          <div>
            <h4>Couldn&apos;t read your dockets</h4>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {!scanning && visible.length === 0 ? (
        <div className="empty">
          <h3>Nothing here yet</h3>
          <p>
            {tab === "client"
              ? "Dockets you post will appear here, with the actions you can take on each."
              : "Dockets you claim will appear here, with the deliverable submission step."}
          </p>
          <Link className="btn" href={tab === "client" ? "/dockets/new" : "/register"}>
            {tab === "client" ? "Post your first docket" : "Browse open work"}
          </Link>
        </div>
      ) : (
        visible.map(({ id, docket: d }) => (
          <Link key={`${id}-${tab}`} className="register-row" href={`/docket/${id}`}>
            <div className="docket-id">{docketRef(id)}</div>
            <div>
              <p className="row-title">{d.sow_text}</p>
              <p className="row-sub">{STATUS_LABEL[d.status] ?? "Unknown"}</p>
            </div>
            <div className={`chip ${d.status === 0 ? "chip-open" : "chip-claimed"}`}>
              {STATUS_LABEL[d.status]}
            </div>
            <div className="amount">{formatGen(d.amount)}</div>
            <div className="deadline">{relativeDeadline(d.deadline)}</div>
          </Link>
        ))
      )}
    </>
  );
}