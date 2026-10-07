/**
 * The single source of truth for chain configuration.
 *
 * Per docs/06-integration-plan.md: contract address, chain config and schema live in one
 * typed module. No component may hardcode an address or RPC URL.
 *
 * Deployed contract (verified 2026-10-07, see evidence/studionet-deployment-2026-10-07.txt):
 * the on-chain code is byte-identical to contracts/docket.py and the address-derived schema
 * matches docs/04-contract-spec.md.
 */

export type NetworkId = "studionet" | "testnet-bradbury" | "localnet";

export type NetworkConfig = {
  id: NetworkId;
  label: string;
  chainId: number;
  rpcUrl: string;
  /** Explorer base for contract pages and transaction links. */
  explorerTxUrl: (hash: string) => string;
  explorerAddressUrl: (address: string) => string;
  /**
   * Whether an emitted value transfer credits a chain-layer EOA balance. Verified false on
   * Studionet: escrow leaves the contract correctly but the payout child transaction
   * finalizes with an execution error, so the recipient is never credited. See
   * evidence/integration-studionet-2026-10-07.txt.
   */
  creditsEoaPayouts: boolean;
  /** Whether the network exposes appeal primitives at all. Verified false on Studionet. */
  supportsAppeals: boolean;
};

const NETWORKS: Record<NetworkId, NetworkConfig> = {
  studionet: {
    id: "studionet",
    label: "GenLayer Studionet",
    chainId: 61999,
    rpcUrl: "https://studio.genlayer.com/api",
    explorerTxUrl: (h) => `https://explorer-studio.genlayer.com/tx/${h}`,
    explorerAddressUrl: (a) => `https://explorer-studio.genlayer.com/address/${a}`,
    creditsEoaPayouts: false,
    supportsAppeals: false,
  },
  "testnet-bradbury": {
    id: "testnet-bradbury",
    label: "GenLayer Testnet Bradbury",
    chainId: 61999,
    rpcUrl: "https://bradbury.genlayer.com/api",
    explorerTxUrl: (h) => `https://explorer-bradbury.genlayer.com/tx/${h}`,
    explorerAddressUrl: (a) => `https://explorer-bradbury.genlayer.com/address/${a}`,
    // UNVERIFIED. Both were false on Studionet and have not been checked on Bradbury.
    // Kept false so the UI never promises a payout or appeal until someone verifies it.
    creditsEoaPayouts: false,
    supportsAppeals: false,
  },
  localnet: {
    id: "localnet",
    label: "GenLayer Localnet",
    chainId: 61127,
    rpcUrl: "http://127.0.0.1:4000/api",
    explorerTxUrl: (h) => `http://127.0.0.1:4000/tx/${h}`,
    explorerAddressUrl: (a) => `http://127.0.0.1:4000/address/${a}`,
    creditsEoaPayouts: true,
    supportsAppeals: true,
  },
};

export const ACTIVE_NETWORK: NetworkId =
  (process.env.NEXT_PUBLIC_GENLAYER_NETWORK as NetworkId) ?? "studionet";

export const network = NETWORKS[ACTIVE_NETWORK];

/**
 * Deployed Docket contract on the active network. Overridable so the same build can point at
 * a freshly deployed address without editing source.
 */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_DOCKET_CONTRACT_ADDRESS ??
  "0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B") as `0x${string}`;

/** Cap on evidence URLs the UI will let someone attach, mirroring the contract's own bound. */
export const MAX_EVIDENCE_URLS = 10;

/** GEN has 18 decimals, matching the chain's native currency definition. */
export const GEN_DECIMALS = 18;