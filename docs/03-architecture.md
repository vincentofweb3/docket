# 03 — Architecture

## System layers

Docket follows the three-layer pattern GenLayer's own docs recommend for "when to use
GenLayer": frontend/backend for UX and non-critical logic, the Intelligent Contract for the
consensus-critical decision, and GenLayer validators to independently verify it.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js + genlayer-js)                                    │
│  - Create docket form, deliverable submission form, dispute view     │
│  - Reads contract state via readContract; writes via writeContract   │
│  - Tracks tx lifecycle: submitted → pending → accepted → finalized   │
│  - NEVER calls an LLM to pre-compute a verdict                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ eth_sendRawTransaction / eth_call
┌───────────────────────────────▼───────────────────────────────────────┐
│  GenLayer Chain (EVM-compatible L2, ghost contract holds GEN escrow)  │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────────┐
│  GenVM — Docket Intelligent Contract (contracts/docket.py)            │
│  - Deterministic: docket lifecycle, escrow accounting, reputation     │
│  - Non-deterministic: deliverable-vs-scope adjudication               │
│    (leader/validator functions, see 05-equivalence-and-nondeterminism)│
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ leader proposes → validators recompute
┌───────────────────────────────▼───────────────────────────────────────┐
│  GenLayer Validators (Optimistic Democracy)                          │
│  - Independently fetch the same public evidence URLs                 │
│  - Independently call an LLM against the same SOW + criteria         │
│  - Vote on the leader's structured verdict via custom equivalence     │
└─────────────────────────────────────────────────────────────────────┘
```

Optional, out of scope for v1 but designed for: a Python worker agent (using `genlayer-py`)
that autonomously claims dockets matching its capabilities and submits deliverables — see
`docs/10-roadmap.md`.

## Layer boundaries (what belongs where)

| Concern | Layer | Why |
|---|---|---|
| Docket creation form, SOW authoring UX, optional AI-assisted SOW drafting help | Frontend | UX only, no consensus-critical state |
| Evidence URL collection & client-side format checks | Frontend | Fast feedback; contract re-validates anyway |
| Escrow balance, docket status, verdict, reputation score | Contract | Consensus-critical state |
| Fetching evidence + running the adjudication prompt | Contract (inside leader/validator functions) | Must be independently verifiable by every validator |
| Search, notifications, indexing dockets for a dashboard | Backend (off-chain indexer) | Non-critical, cacheable, does not gate settlement |
| Transaction status polling, receipt display | Frontend via genlayer-js | UX only |

## Docket lifecycle (state machine)

```
                 create_docket()
                        │
                        ▼
                  ┌───────────┐
                  │   OPEN    │  (escrow locked, awaiting a worker)
                  └─────┬─────┘
                        │ claim_docket()
                        ▼
                  ┌───────────┐
                  │  CLAIMED  │  (worker assigned, deadline running)
                  └─────┬─────┘
                        │ submit_deliverable()
                        ▼
                  ┌───────────┐
        ┌─────────┤ SUBMITTED ├─────────┐
        │         └───────────┘         │
 accept_deliverable()             dispute_deliverable()
        │                               │
        ▼                               ▼
  ┌───────────┐                 ┌───────────────┐
  │ ACCEPTED  │                 │  ADJUDICATING  │  (leader/validator verdict)
  │ (fast     │                 └───────┬────────┘
  │  path)    │                         │ verdict reached (Optimistic Democracy
  └─────┬─────┘                         │  + native appeal window apply here)
        │                               ▼
        │                        ┌───────────────┐
        │                        │   RESOLVED     │  (escrow split per verdict)
        │                        └───────┬────────┘
        └───────────────┬────────────────┘
                         ▼
                  ┌───────────┐
                  │  CLOSED   │  (reputation ledger updated, funds released)
                  └───────────┘

  Any state before SUBMITTED × deadline passed → EXPIRED → refund_expired()
```

This maps directly onto GenLayer's own transaction lifecycle (`Pending → Proposing →
Committing → Revealing → Accepted → Finalized`, with `Undetermined` on failed consensus and
native appeals during the finality window) — Docket's `ADJUDICATING` state is exactly one
GenLayer transaction going through that native pipeline, not a custom reimplementation of
it.

## Money flow & escrow accounting

- `create_docket(sow_hash, threshold_bp, deadline)` is `@gl.public.write.payable`; the sent
  `value` becomes the escrowed amount for that docket, held by the contract's ghost account.
- On `ACCEPTED` (fast path) or `RESOLVED` with verdict `full`: 100% of escrow → worker.
- On `RESOLVED` with verdict `partial`: `score / 100 * escrow` → worker (only if `score >=
  threshold_bp / 100`, otherwise treated as `reject`), remainder → client refund.
- On `RESOLVED` with verdict `reject`, or `EXPIRED` with no submission: 100% of escrow →
  client refund.
- All transfers happen via `emit_transfer()` **after** the non-deterministic block returns,
  in deterministic contract code — never inside `leader_fn`/`validator_fn`. This matches the
  documented rule that storage writes, contract calls, and message emission must be outside
  nondet blocks.
- A small, fixed protocol fee (configurable constant, default 0, so it's off unless a
  deployer explicitly turns it on) can optionally be carved out on `RESOLVED`/`ACCEPTED` for
  a future treasury — deferred to `docs/10-roadmap.md`, not built in v1 to keep the audited
  surface small.

## Reputation ledger

A `TreeMap[Address, ReputationRecord]` (see `docs/04-contract-spec.md`) tracks, per address:
completed dockets, disputes entered, disputes where the address's position was upheld by the
verdict, and a rolling average score. This is intentionally minimal — it is meant to be
*read* by other contracts or by an ERC-8004-style identity/reputation system, not to
reimplement reputation scoring itself.

## Why not just do this off-chain with an LLM?

Because the two parties don't trust each other's LLM call, or a shared platform's LLM call,
by definition — that's the dispute. The entire value of putting this on GenLayer is that
neither party, and no single backend, gets to be the one whose LLM output is trusted. Every
validator runs its own fetch and its own inference, and consensus — not authority — decides.
