# Docket

**Deliverable escrow and spec-compliance adjudication for the agentic economy, built on GenLayer.**

> "Every job has a scope. Docket settles whether it was met."

Docket is a GenLayer Intelligent Contract system that lets a client and a worker (human or
AI agent) put a job's payment in escrow against a written Scope of Work, and — if they
disagree about whether the deliverable met that scope — get a neutral, evidence-based,
decentralized verdict from GenLayer's AI-validator consensus instead of relying on a
platform's internal discretion, a manual arbitrator, or blind trust.

This is **not** a prediction market, a generic AI chatbot wrapper, or a moderation tool.
It is a narrow, well-defined settlement primitive for one recurring problem: *"was the
work delivered to spec?"* — the exact gap GenLayer's own docs identify as missing from
every agentic-commerce standard being built today (x402, ERC-8004, A2A, ACP, AP2).

## Why this is a good GenLayer fit

Read [`docs/02-genlayer-fit-checklist.md`](docs/02-genlayer-fit-checklist.md) for the full
mapping against GenLayer's own "When to Use GenLayer" checklist. Short version:

- Real on-chain consequence → escrow release, partial release, or refund.
- Requires judgment → does the deliverable meet a natural-language Scope of Work?
- Evidence is independently checkable → only public URLs (repos, deployed endpoints,
  documents, API responses) are accepted as evidence; validators fetch it themselves.
- Neutral consensus is required → client and worker are counterparties with no shared
  trusted backend.
- The decision is structured → `verdict ∈ {full, partial, reject}`, a `0–100` compliance
  `score`, and a short `rationale` — not open-ended prose.

## Repository layout

```
docket/
├── README.md                          — you are here
├── AUDIT_HANDOFF.md                   — current status, evidence map, and next-agent procedure
├── CLAUDE.md                          — instructions for the coding agent (start here)
├── LICENSE
├── .env.example
├── docs/                              — product, architecture, security, submission docs
│   ├── 01-product-vision.md
│   ├── 02-genlayer-fit-checklist.md
│   ├── 03-architecture.md
│   ├── 04-contract-spec.md
│   ├── 05-equivalence-and-nondeterminism.md
│   ├── 06-integration-plan.md
│   ├── 07-security-and-audit-checklist.md
│   ├── 08-testing-plan.md
│   ├── 09-submission-and-review-readiness.md
│   └── 10-roadmap.md
├── design/                            — page-by-page product design (13 pages total)
│   ├── design-system.md               — tokens, typography, layout rationale, file index
│   ├── index.html                     — full marketing landing page
│   ├── landing.html                   — in-app browse / open-docket register
│   ├── docket-detail.html             — single docket record + claim action
│   ├── create-docket.html             — docket-creation form (client)
│   ├── submit-deliverable.html        — evidence-submission form (worker)
│   ├── adjudicating.html              — live dispute waiting state
│   ├── adjudication-result.html       — resolved docket + verdict seal
│   ├── appeal.html                    — appeal / bond flow
│   ├── connect-wallet.html            — onboarding / wallet connect
│   ├── my-dockets.html                — client/worker dashboard
│   ├── reputation.html                — read-only reputation profile
│   ├── states.html                    — empty & error state reference
│   └── components.html                — transaction-status component reference
├── assets/
│   └── docket-logo.png                — 1024px submission logo (navy/cream/gold)
├── contracts/
│   └── docket.py                      — the Intelligent Contract (Python, GenVM), the whole product
├── tests/
│   ├── direct/test_docket_direct.py   — 29 in-VM unit tests (genlayer-test 0.29.2 gltest_direct)
│   └── integration/                   — Studionet consensus tests (gltest)
├── evidence/                          — 42 dated gate artifacts: lint JSON, raw test output,
│                                        Studionet receipts, fund traces, framing scans
├── frontend/                          — Next.js 16 App Router UI (deployed to Vercel)
│   ├── src/app/                       — 12 routes: register, docket/[id], submit, result,
│   │                                    new, my-dockets, reputation, how-it-works, appeal-guide,
│   │                                    connect-wallet, plus api/{encode,tx,dockets}
│   ├── src/components/                — 16 components (DocketActions, StatusChip, TxStatusToast,
│   │                                    NetworkLimits, MyDockets, SubmitDeliverableForm, …)
│   ├── src/lib/                       — genlayer client + encoder, tx lifecycle state machine,
│   │                                    wallet EIP-1193 + write path, chain-state, scan-cache
│   ├── tests/                         — 60 vitest tests: contract-parity, responsive guard,
│   │                                    write-targeting, tx-lifecycle, network-flags
│   └── vercel.json                    — Vercel build config (root dir must be `frontend`)
└── scripts/
    ├── quality_gates.sh               — lint → direct tests → integration, in order
    └── deploy/                        — deploy.mjs, seed-demo.mjs, verify.mjs, docket-lib.mjs
```

> Correction (2026-10-13): an earlier revision described `contracts/docket.py` as a "skeleton" and
> `frontend/` as a "package skeleton". Both were wrong by a wide margin — the contract is complete
> and deployed, and `frontend/` is a working ~40-file application that builds and reads the live
> contract.

### Status

**Deployed to Studionet** at `0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B`
([explorer](https://explorer-studio.genlayer.com/address/0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B)).
Deployed code is byte-identical to `contracts/docket.py`. Lint passes, 29/29 direct tests pass,
and the Studionet integration suite is **5 passed, 1 skipped, exit 0** against real validator
consensus.

### Dockets on chain (ids 0–7; `get_docket(8)` does not exist)

| id | Status | Amount | What it is |
|---|---|---|---|
| 0 | CLOSED | 0 GEN | First dispute lifecycle — `full` verdict, AI adjudication agreed |
| 1 | CLOSED | 0 GEN | Dispute lifecycle → **`reject`, score 10**, three unmet criteria recorded |
| 2 | CLOSED | 0 GEN | Appeal-flow probe (finalized; Studionet exposes no appeal RPCs) |
| 3 | CLOSED | 0 GEN | Fund-trace probe establishing that emitted payouts do not credit EOAs |
| 4 | OPEN | 420 GEN | Demo docket — Farcaster frame |
| 5 | OPEN | 1,150 GEN | Demo docket — HTTP/1.1 implementation guide |
| 6 | OPEN | 300 GEN | Demo docket — Optimism diagrams |
| 7 | OPEN | 1 GEN | Write-targeting verification docket (created 2026-10-12) |

**Dockets 0–3 are deliberate, documented test fixtures, not demo content.** They are finalized and
cannot be deleted from chain state, so they remain visible in the public register. Each one
corresponds to a specific finding recorded in `evidence/`: #0 and #1 are the two complete
adjudication lifecycles, #2 probed appeals, #3 established the EOA-payout limitation that
`evidence/integration-studionet-2026-10-07.txt` and the `_eoa_credit_supported` NOTICE gate depend
on. They carry a 0 GEN escrow, so they cannot be mistaken for live paid work.

Transaction hashes and explorer links are in
[`evidence/studionet-deployment-2026-10-07.txt`](evidence/studionet-deployment-2026-10-07.txt).

Consolidated gate status and every open issue:
[`evidence/quality-gates-2026-10-07.md`](evidence/quality-gates-2026-10-07.md).

Two limitations to understand before making any claim about this deployment:

- **GEN does not reach a recipient wallet on Studionet.** Escrow leaves the contract and the
  contract settles to zero, but the payout to a worker EOA finalizes with an execution error,
  so the worker is never credited. This is a Studionet limitation (no EVM layer / ghost
  contracts), not escrow-logic failure. Docket demonstrates adjudication and escrow accounting
  are correct and consensus-final; it does not demonstrate real payouts on this network.
- **Appeals cannot be exercised on Studionet** — the appeal RPCs do not exist there, so the
  appeal test skips with a stated reason.

Repository: <https://github.com/vincentofweb3/docket>.

## Deploying the frontend

The app lives in `frontend/`, so **Root Directory must be `frontend`** — deploying from the repo
root fails, because the root `package.json` only holds the contract deploy scripts and has no
Next.js app.

On Vercel: import the repo, set Root Directory to `frontend`, and add

```
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_DOCKET_CONTRACT_ADDRESS=0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B
```

See [`frontend/README.md`](frontend/README.md) for the full screen/API map and the network
capability notes.

## Quick start (for the agent picking this up)

1. Read `AUDIT_HANDOFF.md` and `CLAUDE.md` in full before touching any file.
2. Read `docs/03-architecture.md`, `docs/04-contract-spec.md`, `docs/07-security-and-audit-checklist.md`, and `docs/09-submission-and-review-readiness.md`.
3. Preserve the existing evidence and recompute the contract hash before relying on prior results.
4. `genvm-lint` needs `GENVM_VERSION=v0.3.0-rc7`; see `scripts/quality_gates.sh`.
5. When calling `get_reputation` (or any `Address`-typed parameter) from a client, wrap the
   address — see the `CalldataAddress` note in `evidence/quality-gates-2026-10-07.md`.

## License

MIT — see `LICENSE`. Docket is an independent open-source project built on the GenLayer
protocol; it is not an official GenLayer Labs or GenLayer Foundation product.
