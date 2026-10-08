"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { currentAccount, detectInjectedProvider, type Eip1193Provider } from "./wallet";

/**
 * Wallet state shared across pages.
 *
 * Kept in one place so the nav's connect control, the docket action buttons and the My Dockets
 * dashboard can never disagree about whether a wallet is attached. Also listens for
 * accountsChanged, so switching accounts in the wallet updates the UI without a reload — without
 * that, a stale address would keep rendering the previous account's dockets.
 */
type WalletState = {
  hasWallet: boolean | null;
  account: string | null;
  provider: Eip1193Provider | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const provider = detectInjectedProvider();
    setHasWallet(Boolean(provider));
    setAccount(provider ? await currentAccount() : null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const provider = detectInjectedProvider();
    if (!provider?.on) return;

    const onAccountsChanged = () => void refresh();
    const onChainChanged = () => void refresh();
    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);

    return () => {
      // Providers are not guaranteed to implement removeListener.
      try {
        provider.removeListener?.("accountsChanged", onAccountsChanged);
        provider.removeListener?.("chainChanged", onChainChanged);
      } catch {
        /* nothing to clean up */
      }
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    const provider = detectInjectedProvider();
    if (!provider) {
      setError("No GenLayer-enabled wallet was detected in this browser.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(accounts?.[0] ?? null);
    } catch (err) {
      setError(
        /reject|denied/i.test((err as Error)?.message ?? "")
          ? "The wallet declined the connection request."
          : ((err as Error)?.message ?? "Could not connect to the wallet."),
      );
    } finally {
      setConnecting(false);
    }
  }, []);

  /**
   * Disconnect.
   *
   * Prefers the standard EIP-2255 `wallet_revokePermissions`, which is the only way to genuinely
   * drop a site's access. Not every wallet implements it, so on rejection the local session is
   * cleared instead and the UI drops back to disconnected — which is honest, since the app holds
   * no server-side session to destroy.
   */
  const disconnect = useCallback(async () => {
    const provider = detectInjectedProvider();
    setError(null);
    if (provider?.request) {
      try {
        await provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Wallet does not support revocation; fall through to the local reset.
      }
    }
    setAccount(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        hasWallet,
        account,
        provider: detectInjectedProvider(),
        connecting,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export const shortAccount = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
