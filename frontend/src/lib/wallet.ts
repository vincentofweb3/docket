/**
 * Signer access for write paths.
 *
 * genlayer-js's `metamaskClient` only reports whether the GenLayer Snap is installed — it does
 * not sign. Signing an Intelligent Contract transaction needs a GenLayer-enabled wallet, so
 * writes are gated on an injected EIP-1193 provider. Reads never touch this module.
 */

import { network } from "./config";

export type Signer = {
  address: `0x${string}`;
  /** EIP-1193 request, used to send the raw GenLayer transaction. */
  provider: Eip1193Provider;
};

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  /** Injected providers are EIP-1193 event emitters; optional because not all wallets expose it. */
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean;
      providers?: Eip1193Provider[];
    };
  }
}

export function detectInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const injected = window.ethereum;
  if (!injected) return null;
  // MetaMask can expose several injected providers; prefer the GenLayer-capable one.
  const providers = (injected.providers ?? []) as (Eip1193Provider & {
    isMetaMask?: boolean;
    isGenLayer?: boolean;
  })[];
  const preferred =
    providers.find((p) => p.isGenLayer) ?? providers.find((p) => p.isMetaMask) ?? providers[0];
  return preferred ?? injected;
}

/**
 * Ask for the connected account. Throws if there is no wallet, so callers can fall back to a
 * "connect your wallet" gate rather than failing opaquely.
 */
export async function connectSigner(): Promise<Signer> {
  const provider = detectInjectedProvider();
  if (!provider) throw new Error("NO_WALLET");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("NO_ACCOUNT");
  return { address: address as `0x${string}`, provider };
}

export async function currentAccount(): Promise<string | null> {
  const provider = detectInjectedProvider();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether an appeal can even be attempted. Verified false on Studionet: `gen_appealTransaction`,
 * `gen_getAppealCharge` and `gen_canAppeal` all return -32601, and the SDK's chain definition
 * sets the appeal/fee/rounds contracts to null. Reported honestly rather than shown as a
 * button that cannot work.
 */
export function appealSupportNote(): {
  support: "absent" | "present" | "working";
  supported: boolean;
  message: string;
} {
  const support = network.appealSupport;

  if (support === "absent") {
    return {
      support,
      supported: false,
      message:
        `Appeals are not available on ${network.label}. The network exposes no appeal ` +
        "primitives (gen_appealTransaction, gen_getAppealCharge and gen_canAppeal all return " +
        "Method not found), and an appeal must be funded with the charge those calls return - " +
        "which this SDK version does not implement. This is a network limitation, not a Docket " +
        "limitation.",
    };
  }

  if (support === "present") {
    return {
      support,
      // Not offered as a one-click action: submitting an appeal needs the charge quoted at the
      // moment of submission, which this SDK version cannot read.
      supported: false,
      message:
        `${network.label} has the appeal infrastructure deployed - the appeals, fee-manager ` +
        "and rounds-storage contracts all respond to calls - but no appeal has been driven " +
        "end-to-end against Docket yet. An appeal also has to be funded with the charge " +
        "quoted immediately before submission, so the bond is never hardcoded here.",
    };
  }

  return {
    support,
    supported: true,
    message:
      "Appeals are a native GenLayer transaction-level action. Quote the current appeal " +
      "charge and submit it immediately before - never hardcode the bond.",
  };
}
