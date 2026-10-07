# CLAUDE.md — Operating Instructions for the Coding Agent

You are picking up **Docket**, a GenLayer Intelligent Contract project, at the scaffolding
stage. Nothing has been linted, tested, or deployed. Follow this file in order. Do not skip
the verification step — every past rejection of a GenLayer submission traces back to either
(a) a guessed API that doesn't match the current SDK, or (b) a contract that reads as a
disguised prediction market / generic AI wrapper rather than a genuine adjudication use case.
Docket is deliberately designed to avoid both. Don't undo that by improvising.

## 0. Ground rules (non-negotiable)

- Treat GenLayer as a blockchain/protocol for **trustless adjudication**, not a synonym for
  "Intelligent Contracts." Intelligent Contracts are the product; adjudication is the point.
- **Never guess a `gl.*` API.** Every call in `contracts/docket.py` was written against the
  documentation available on 2026-08-23 (cited inline as comments). APIs change. Before you
  write a single new line of contract code, or before you trust an existing line, verify it
  against the GenLayer Docs MCP or `https://docs.genlayer.com/full-documentation.txt` and
  `https://sdk.genlayer.com/main/_static/ai/api.txt`.
- Do not model GenLayer as a normal deterministic EVM chain. Every non-deterministic
  operation (LLM call, web fetch, image analysis) needs an explicit equivalence strategy —
  see `docs/05-equivalence-and-nondeterminism.md` before touching consensus logic.
- Do not turn this into a prediction market. The user explicitly ruled that out. Docket
  resolves **work-for-hire disputes**, not speculative bets on future events. Keep the
  domain language (docket, scope of work, deliverable, verdict) — don't drift toward
  "market", "odds", or "bet".

## 1. Setup

```bash
# GenLayer Skills plugin (Claude Code)
claude /plugin marketplace add genlayerlabs/skills
claude /plugin install genlayer-dev@genlayerlabs

# MCP context (if your client supports MCP)
claude mcp add genlayer-docs --transport sse https://docs-mcp.genlayer.com/sse
claude mcp add genlayer npx -- -y genlayer-mcp

# CLI + tooling
npm install -g genlayer
pip install genvm-linter --break-system-packages
pip install "genlayer-test[sim]" --break-system-packages
```

If any of the above is unavailable in the WSL sandbox (no network egress to a given host, no
Docker, no browser for faucet claiming), say exactly what's blocked and give the next manual
step. Do not silently skip a quality gate.

## 2. Read before you write

In this order:

1. `docs/01-product-vision.md` — what Docket is and isn't.
2. `docs/02-genlayer-fit-checklist.md` — why this belongs on GenLayer at all.
3. `docs/03-architecture.md` — system layers, contract boundaries, state machine.
4. `docs/04-contract-spec.md` — every method, every storage field, every error code.
5. `docs/05-equivalence-and-nondeterminism.md` — the consensus design for the one hard part
   of this contract: deciding whether a deliverable meets a natural-language spec.
6. `docs/07-security-and-audit-checklist.md` — prompt-injection defenses, storage typing,
   fund-safety invariants. Treat this as a checklist you must satisfy, not background
   reading.

## 3. Build workflow

1. Confirm scope: contract-only first, then frontend integration, in that order. Do not
   start the frontend before the contract passes direct tests.
2. Use the pinned `Depends` header already in `contracts/docket.py`. If the docs MCP reports
   a newer pinned hash, update it and note the change in the audit file — never use an
   unpinned or `latest` dependency.
3. Confirm the equivalence strategy for each non-deterministic method against
   `docs/05-equivalence-and-nondeterminism.md` before implementing it. Do not default to
   `strict_eq` on anything involving an LLM call — it is documented as unsuitable for that.
4. Use GenLayer storage types only: `TreeMap`, `DynArray`, `@allow_storage` dataclasses,
   sized integers. Never store a raw Python `dict` or `list` as contract state — the linter
   should catch this, but verify by hand too.
5. Classify every error path per `docs/04-contract-spec.md` §Error Codes: `EXPECTED`,
   `EXTERNAL`, `TRANSIENT`, `LLM_ERROR`. This determines whether a validator disagreement
   should match, tolerate, or force leader rotation — get it wrong and disputes will
   deadlock or resolve unfairly.
6. Run the quality gates **in this exact order**, every time, and do not proceed to the next
   gate on failure:
   ```bash
   genvm-lint check contracts/docket.py --json
   pytest tests/direct/ -v
   gltest tests/integration/ -v -s     # only once direct tests are green
   ```
   `scripts/quality_gates.sh` runs all three in sequence and stops on first failure.
7. Deploy to Studionet first (gasless, `0 GEN` is expected and fine), then Localnet if you
   need full control, then Bradbury testnet once you're ready for real LLM/web behavior.
   Bradbury requires a funded account — the faucet at
   `https://testnet-faucet.genlayer.foundation/` is browser-based and cannot be automated;
   tell the user directly when you need them to claim testnet GEN manually.
8. Debug any failed transaction with `genlayer receipt <txHash> --stdout --stderr`, then
   `genlayer schema <address>`, then `genlayer code <address>`, then read calls — in that
   order — before changing contract code.

## 4. Frontend / integration gap

The genlayer-dev skill is strong on contract writing, linting, tests, and deployment, but
does **not** fully define frontend/backend integration. Before wiring the UI:

- Generate or inspect the deployed contract's schema (`genlayer schema <address>`) first.
- Use `genlayer-js` (`createClient`, `readContract`, `writeContract`, transaction status,
  receipts) for the Next.js/React frontend described in `docs/06-integration-plan.md`.
  Verify exact method names in the SDK reference — do not invent them.
- If any part of Docket needs a Python backend/agent runner (e.g. an autonomous worker
  agent that claims dockets and submits deliverables), use `genlayer-py` and verify its
  current API surface the same way.
- Always distinguish read/view calls from write/transaction calls in the UI, and show
  submitted → pending → finalized/failed states, matching the real transaction lifecycle
  documented in `docs/03-architecture.md`.

## 5. Before you consider this "done"

Walk `docs/09-submission-and-review-readiness.md` literally, line by line. GenLayer's
Points/Builder submissions are steward-reviewed against **public URL evidence only** — no
file uploads. That checklist tells you exactly which URLs (repo, deployed contract address
+ explorer link, demo, test output) you need to have in hand before anyone submits this for
review. A submission a steward can't independently verify from a link is a submission that
gets sent back for "more information needed" or rejected outright — don't let that happen
here.

## 6. If something is blocked

Say exactly what's blocked (missing tool, missing network egress, no funded testnet account,
no LLM provider key) and give the next concrete command or manual step. Never quietly fall
back to a guessed implementation to make progress look continuous.
