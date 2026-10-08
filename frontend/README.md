# Docket Frontend

Next.js 16 (App Router) + TypeScript frontend for Docket, wired to the Intelligent Contract
deployed on GenLayer Studionet at
`0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B`.

Implements `docs/06-integration-plan.md` and transcribes `design/design-system.md` (tokens,
type roles, the ruled register layout, and the verdict seal).

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
npm test         # contract-parity tests
npm run typecheck
```

Reads work with no wallet. Writes need a GenLayer-enabled wallet (MetaMask + GenLayer Snap),
because `genlayer-js`'s `metamaskClient` only reports Snap installation — it does not sign.

## Configuration

Everything network-specific lives in `src/lib/config.ts`. No component hardcodes an address or
RPC URL. Override without editing source:

```bash
NEXT_PUBLIC_GENLAYER_NETWORK=studionet|testnet-bradbury|localnet
NEXT_PUBLIC_DOCKET_CONTRACT_ADDRESS=0x...
```

`config.ts` also records two per-network capability flags, `creditsEoaPayouts` and
`supportsAppeals`. Both are **false** on Studionet because they were measured there, not assumed.
The UI uses them to avoid offering actions that cannot work, and to disclose limitations where a
user would otherwise be misled.

## Screens

| Route | Design reference | Reads | Writes |
|---|---|---|---|
| `/` | `design/index.html` | live stats | — |
| `/register` | `design/landing.html` | `list_open_dockets`, `get_docket` | — |
| `/docket/[id]` | `design/docket-detail.html` | `get_docket` | `claim_docket`, `submit_deliverable`, `accept_deliverable`, `dispute_deliverable`, `refund_expired` |
| `/docket/[id]/result` | `design/adjudication-result.html` | `get_docket` | — |
| `/docket/[id]/submit` | `design/submit-deliverable.html` | `get_docket` | `submit_deliverable` |
| `/dockets/new` | `design/create-docket.html` | — | `create_docket` |
| `/my-dockets` | `design/my-dockets.html` | bounded id scan | — |
| `/reputation/[address]` | `design/reputation.html` | `get_reputation` | — |
| `/how-it-works` | new | — | — |
| `/appeal-guide` | `design/appeal.html` | — | native appeal (unsupported on Studionet) |
| `/connect-wallet` | `design/connect-wallet.html` | — | wallet connect / disconnect |
| `/reputation` | `design/reputation.html` | — | — |

`design/states.html` and `design/components.html` are component references rather than routes;
their patterns are implemented in `src/components/TxStatusToast.tsx` and `globals.css`.

## Rules this frontend does not bend

From `docs/06-integration-plan.md`, `docs/07-security-and-audit-checklist.md` and
`design/frontend/README.md`:

- **Never pre-computes a verdict.** No LLM call anywhere in this codebase. Docket links to the
  same evidence URLs a validator would fetch and leaves judgement to consensus.
- **Never collapses a write into a spinner.** `src/lib/tx.ts` polls the real transaction and
  surfaces submitted → pending → proposing/committing → revealing → accepted → finalized, with
  distinct failed and undetermined states. A disputed adjudication takes minutes and the UI says
  so explicitly rather than looking hung.
- **Reads and writes are separated.** Reads use `readContract`; writes go through an injected
  EIP-1193 provider and are gated on a connected wallet.
- **Failed reads are loud.** When the RPC is unreachable the register reports the error and shows
  no rows, rather than falling back to sample data that would misrepresent escrowed funds.
- **Error codes are surfaced by name.** `src/lib/docket.ts` maps every `EXPECTED_*`,
  `EXTERNAL_*` and `LLM_ERROR_*` code the contract can raise to a specific explanation.
- **Marketing figures are computed live.** The design mockup carried invented stats
  ("212 dockets resolved"); `/` computes its own from chain state and says "—" when the RPC is
  down, rather than shipping fabricated numbers.

## Implementation notes worth knowing

**Address encoding.** `genlayer-js` 1.1.8 does not re-export `CalldataAddress` from the package
root. A plain hex address passed to `readContract`/`writeContract` is encoded as `TYPE_BYTES`,
and GenVM's `TreeMap` then raises `assert isinstance(r, Address)` — so every external call taking
an `Address` reverts. Internal in-contract calls are unaffected, which is why contract-level
tests never catch it. `src/lib/address.server.ts` locates the real class in the package's dist
chunks and fails loudly rather than silently degrading to bytes. This module is server-only.

**RPC rate limits.** Studionet allows 30 requests/minute. Two consequences:

- `src/lib/genlayer.ts` classifies a missing docket (`KeyError` in the leader receipt's stderr)
  separately from a throttled request. Conflating them makes a rate limit report "no dockets
  exist" — an empty register that looks like real state.
- `scanAllDockets` seeds its upper bound from `list_open_dockets` (one cheap call) instead of
  blind-probing, and `scanAllDocketsCached` memoises for 60s. A cold `/` render takes ~20s
  against the rate limit; warm renders are instant.

**No index by address.** The contract has no read that lists dockets for an address, so
`/my-dockets` walks a bounded range of sequential ids and says so in the UI rather than implying
completeness.

## Known limitations

- **Escrow payouts do not credit a wallet on Studionet.** The contract settles correctly and the
  escrow leaves the contract, but the emitted transfer to a recipient EOA finalizes with an
  execution error, because Studionet has no EVM layer or ghost contracts. `NetworkLimits`
  discloses this next to any settlement that involves a payout. Measured in
  `evidence/studionet-fund-trace-2026-10-07.json`.
- **Appeals are unavailable on Studionet.** `gen_appealTransaction`, `gen_getAppealCharge` and
  `gen_canAppeal` all return -32601, and this SDK version does not implement the documented
  `getAppealCharge` API. `/appeal-guide` explains the mechanism and reports the gap rather than
  wiring a button to an RPC that does not exist.

## Wallet handling

`src/lib/wallet-context.tsx` owns the single wallet state shared by the nav, the docket action
buttons and My Dockets, so they cannot disagree about whether a wallet is attached. It listens for
`accountsChanged`, so switching accounts in the wallet updates the UI without a reload — otherwise
a stale address would keep rendering the previous account's dockets.

Disconnect prefers the standard EIP-2255 `wallet_revokePermissions`. Wallets that do not implement
revocation fall back to clearing local state, which is the most that can honestly be done: there is
no server-side session to destroy.

An earlier duplicate `WalletConnect` component was removed so there is one connect implementation
rather than two.

## Navigation and footer

The connect control sits in the nav against the paper background, so it is a **white surface with a
ledger hairline** rather than the solid ink fill used for primary in-page actions. Nav links carry
no underline on hover — affordance comes from colour, because the connect button is itself an
`<a>` inside `.site-nav`, so an underline rule there would also strike through the button.

The footer is a four-column reference block over a base rule — Product / Learn / Project plus a
brand column — kept ruled and flat so it matches the register instead of becoming a separate visual
language.

## Fund safety: the wrong-network guard

`src/lib/wallet-write.ts` refuses to write unless the wallet is on the expected chain, and it is
checked **twice** — before the wallet is ever asked to sign, and again immediately before
broadcasting, in case the chain changed while the prompt was open.

This exists because of a real incident. With the wallet left on Ethereum mainnet, the app asked the
user to sign "send 250 ETH" (~$603,000) to `0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575` — a GenLayer
address that is not a contract on that chain, where nothing can recover the funds. **GEN and ETH are
both 18-decimal**, so an escrow of 250 GEN renders as "250 ETH" on the wrong network and the wallet
popup shows the number, not the token. Nothing in that popup distinguishes them.

So the app now:

- throws `WrongNetworkError` before signing, naming both chains and what went wrong
- renders a `NetworkWarning` banner on every screen that can sign, with a one-click network switch
- shows expected network, actual chain id, and native balance on `/connect-wallet`
- refuses to escrow more than the account holds, instead of letting it revert for a confusing reason

`tests/responsive.test.ts` guards the ordering (guard before `eth_sendTransaction`) so the check
cannot be moved after the fact.

MetaMask also disables **Sign** on a chain it cannot simulate, which is normal for a custom
network. If the button stays disabled on the correct GenLayer chain, check the account balance first.

## Network support

Bradbury (`https://rpc-bradbury.genlayer.com`, chainId 4221) is reachable and **is** usable, with
two differences from Studionet:

- **Appeals exist there.** `appealsContract`, `feeManagerContract` and `roundsStorageContract`
  are all deployed and answer `eth_call` (verified 2026-10-07). `config.ts` models this as a
  three-state `appealSupport`: `"absent"` (Studionet), `"present"` (Bradbury — contracts
  deployed but no appeal driven end-to-end yet), `"working"` (an appeal actually succeeded).
  The appeal guide renders each state differently instead of collapsing them.
- **It is not gasless.** `0x81840a3450BeCf32672fd95d0278279f2a3EF486` holds 0 GEN there, and the
  faucet at <https://testnet-faucet.genlayer.foundation/> is gated behind Cloudflare Turnstile,
  so claiming needs a browser. Deploying to Bradbury therefore needs an operator to fund the
  account first.

`config.ts` still lists `creditsEoaPayouts: false` for Bradbury. That flag is deliberately
conservative: it has not been observed to credit a worker balance there, so the UI will not claim
it until someone watches one rise.
- **Write paths are untested end-to-end** — they need a GenLayer Snap, which cannot be automated
  here. Everything read-only is verified against the live deployment.
- **Responsive layout is enforced by a test, not by eye.** `tests/responsive.test.ts` statically
  asserts the four breakpoint tiers, that the register reflows, that the standards comparison
  table becomes per-record cards with its column labels restored, that key/value rows stack, that
  no fixed width exceeds 360px, and that every `className` in a component has a matching CSS rule.
  That last check earned its place: it caught `.form-grid` (used by the create form, styled
  nowhere) and a `seal-undecided` / `.seal.undecided` naming mismatch that meant the undecided
  verdict stamp never picked up its muted styling on any screen size.

  This is static analysis, not a rendered-pixel check — it runs in CI with no browser, and it
  cannot catch everything an unbreakable long string in real content would cause.

- **Next.js is pinned exactly, not caret-ranged.** Vercel refuses to deploy a build containing a
  Next.js version flagged by its security scan, so a floating `^16` could resolve into a future
  advisory and break deploys for a reason unrelated to this code. Upgrade deliberately and re-verify
  the build.