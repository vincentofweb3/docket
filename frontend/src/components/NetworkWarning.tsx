"use client";

import { network } from "@/lib/config";
import { useChainState } from "@/lib/chain-state";
import type { Eip1193Provider } from "@/lib/wallet";

/**
 * Network warning.
 *
 * The critical case is a wallet left on Ethereum mainnet: an escrow of 250 GEN renders as
 * "250 ETH" there, because both are 18-decimal, and the target address is not a contract on that
 * chain — so the funds would be unrecoverable. The wallet popup shows the number, not the token,
 * so this banner is what actually prevents the mistake.
 */
export function NetworkWarning({ provider }: { provider: Eip1193Provider | null }) {
  const { onExpectedNetwork, chainId, switching, switchError, switchNetwork } =
    useChainState(provider);

  if (onExpectedNetwork !== false) return null;

  return (
    <div className="network-warning" role="alert">
      <div className="nw-head">
        <strong>Your wallet is on the wrong network — nothing will be sent.</strong>
      </div>
      <p>
        This app writes to <strong>{network.label}</strong> (chain id {network.chainId}). Your
        wallet is on chain id {chainId}. Do not sign anything in the wallet popup: because GEN and
        ETH are both 18-decimal, the escrow would be displayed as the same number of a different
        token, sent to an address that is not a contract on that chain and cannot be recovered.
      </p>
      <div className="nw-actions">
        <button className="btn" onClick={switchNetwork} disabled={switching}>
          {switching ? "Switching…" : `Switch to ${network.label}`}
        </button>
        <span className="mono nw-hint">
          chain id {network.chainId} · {network.rpcUrl}
        </span>
      </div>
      {switchError ? <p className="nw-error">{switchError}</p> : null}
    </div>
  );
}
