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
  /**
   * Whether an account must actually hold GEN to escrow it.
   *
   * Verified 2026-10-07 on Studionet: an account with a 0 GEN balance successfully created a
   * docket carrying a 420 GEN escrow, and gasPrice is 0. The network simulates value transfers, so
   * pre-checking the balance here would refuse a transaction that the chain accepts — which it
   * did, blocking the whole demo. Bradbury is a real testnet and does require funds.
   */
  requiresEscrowFunds: boolean;

  /**
   * Appeal capability, in three states, because "works" and "absent" are not the only options:
   *  - "absent":  the network exposes no appeal RPCs at all. Verified on Studionet, where
   *               gen_appealTransaction / gen_getAppealCharge / gen_canAppeal all return -32601
   *               and the SDK chain definition nulls the appeal contracts.
   *  - "present": the appeal contracts are deployed and answer eth_call, but no appeal has been
   *               driven end-to-end. Verified on Bradbury 2026-10-07: appealsContract,
   *               feeManagerContract and roundsStorageContract each hold code and respond.
   *  - "working": an appeal has actually been observed to succeed.
   */
  appealSupport: "absent" | "present" | "working";
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
    requiresEscrowFunds: false,
    appealSupport: "absent",
  },
  "testnet-bradbury": {
    id: "testnet-bradbury",
    label: "GenLayer Testnet Bradbury",
    // chainId and rpc taken from genlayer-js's testnetBradbury chain definition and verified
    // live on 2026-10-07 (eth_chainId -> 0x107d = 4221). An earlier draft here guessed both wrong.
    chainId: 4221,
    rpcUrl: "https://rpc-bradbury.genlayer.com",
    explorerTxUrl: (h) => `https://explorer-bradbury.genlayer.com/tx/${h}`,
    explorerAddressUrl: (a) => `https://explorer-bradbury.genlayer.com/address/${a}`,
    // Both still UNVERIFIED end-to-end: no Bradbury deployment exists yet, because deploying
    // needs testnet GEN and the faucet is Turnstile-gated. Kept false so the UI cannot promise a
    // payout or an appeal that has not actually been observed. Flip these only after watching a
    // worker balance rise, or a real appeal succeed, on Bradbury.
    creditsEoaPayouts: false,
    // gasPrice is 0 and a 0-balance account escrowed 420 GEN successfully (verified 2026-10-07).
    // Bradbury is a real testnet: not gasless, and deploying or posting needs a funded account.
    requiresEscrowFunds: true,
    // Contracts are deployed and answer eth_call (verified 2026-10-07), but no appeal has been
    // driven end-to-end because there is no funded Bradbury account to deploy with yet.
    appealSupport: "present",
  },
  localnet: {
    id: "localnet",
    label: "GenLayer Localnet",
    chainId: 61127,
    rpcUrl: "http://127.0.0.1:4000/api",
    explorerTxUrl: (h) => `http://127.0.0.1:4000/tx/${h}`,
    explorerAddressUrl: (a) => `http://127.0.0.1:4000/address/${a}`,
    creditsEoaPayouts: true,
    requiresEscrowFunds: false,
    appealSupport: "working",
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