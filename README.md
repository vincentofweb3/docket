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
├── contracts/
│   └── docket.py                      — Intelligent Contract skeleton (Python, GenVM)
├── tests/
│   ├── direct/test_docket_direct.py   — fast in-memory unit tests (mocked LLM/web)
│   └── integration/test_docket_integration.py — full consensus tests (gltest)
├── frontend/
│   └── README.md                      — genlayer-js integration plan + package skeleton
└── scripts/
    └── quality_gates.sh               — lint → direct tests → integration tests, in order
```

### Status

**Deployed to Studionet** at `0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B`
([explorer](https://explorer-studio.genlayer.com/address/0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B)).
Deployed code is byte-identical to `contracts/docket.py`. Lint passes, 29/29 direct tests pass,
and the Studionet integration suite is **5 passed, 1 skipped, exit 0** against real validator
consensus. Two complete public lifecycles are on record: one settled by client acceptance, one
disputed and adjudicated by AI validator consensus to `reject` / score 10 with three specific
unmet criteria. All nine transaction hashes and their explorer links are listed in
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

Repository: <https://github.com/vincentofweb3/docket>. Still missing for a Builder Points
submission: a frontend demo.

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
