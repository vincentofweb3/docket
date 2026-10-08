"use client";

import { useCallback, useEffect, useState } from "react";
import { network } from "@/lib/config";
import { nativeBalance, requestChainSwitch } from "@/lib/wallet-write";
import type { Eip1193Provider } from "@/lib/wallet";
import { useWallet } from "@/lib/wallet-context";

export type ChainState = {
  chainId: number | null;
  onExpectedNetwork: boolean | null;
  balance: bigint | null;
  switching: boolean;
  switchError: string | null;
  refresh: () => Promise<void>;
  switchNetwork: () => Promise<void>;
};

/**
 * Track which chain the wallet is actually on.
 *
 * Needed because GEN and ETH are both 18-decimal: an escrow of 250 GEN renders as "250 ETH" on
 * Ethereum mainnet, where the same address means nothing and the transfer is unrecoverable. The
 * user cannot be expected to spot that from the wallet popup, so the app has to say it.
 */
export function useChainState(provider: Eip1193Provider | null): ChainState {
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!provider) {
      setChainId(null);
      return;
    }
    try {
      const raw = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(Number(BigInt(raw)));
    } catch {
      setChainId(null);
    }
  }, [provider]);

  const { account } = useWallet();
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!provider || !account || chainId !== network.chainId) return;
    nativeBalance(provider, account as `0x${string}`)
      .then(setBalance)
      .catch(() => setBalance(null));
  }, [provider, account, chainId]);

  const switchNetwork = useCallback(async () => {
    if (!provider) return;
    setSwitching(true);
    setSwitchError(null);
    const ok = await requestChainSwitch(provider);
    if (!ok) {
      setSwitchError(
        `Your wallet would not switch automatically. Add ${network.label} manually: chain id ` +
          `${network.chainId}, RPC ${network.rpcUrl}.`,
      );
    }
    setSwitching(false);
    await refresh();
  }, [provider, refresh]);

  return {
    chainId,
    onExpectedNetwork: chainId === null ? null : chainId === network.chainId,
    balance,
    switching,
    switchError,
    refresh,
    switchNetwork,
  };
}
