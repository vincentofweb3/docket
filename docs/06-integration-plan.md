# 06 — Integration Plan (genlayer-js / genlayer-py)

GenLayer's own skills are strong on contract authoring but explicitly thin on frontend and
backend integration. This document is the gap-filler the agent should follow instead of
improvising client code.

## Frontend (Next.js + genlayer-js)

Do not start this until `contracts/docket.py` passes direct tests and is deployed to at
least Studionet, and its schema has been generated/inspected (`genlayer schema <address>`).

1. **Config first.** Keep the deployed contract address, chain config (Studionet vs Bradbury
   vs Localnet — see `docs/03-architecture.md` for the layer diagram, and the network table
   in this project's `README.md` for exact RPC endpoints once confirmed against the docs
   MCP), and the generated schema in one typed config module. Never hardcode an address in a
   component.
2. **Client setup.** Use `genlayer-js`'s `createClient` against the chosen network. Verify
   the exact factory signature and chain identifiers in the SDK reference
   (`/api-references/genlayer-js`) before writing it — don't assume it matches another
   project's snapshot.
3. **Reads vs writes, explicitly.** Every screen in `design/` distinguishes a read (`view`
   methods: `get_docket`, `get_reputation`, `list_open_dockets`) from a write (`create_docket`,
   `claim_docket`, `submit_deliverable`, `accept_deliverable`, `dispute_deliverable`,
   `refund_expired`). Reads use `readContract`; writes use `writeContract` and must surface
   the real transaction lifecycle to the user: **submitted → pending → accepted →
   finalized**, plus a distinct **failed/undetermined** state — do not collapse these into a
   single spinner. `dispute_deliverable` in particular can sit in `ADJUDICATING` for the
   length of a full Optimistic Democracy round; the UI must say so, not imply it hung.
4. **Appeals.** If a party wants to appeal an `ACCEPTED` verdict before `FINALIZED`, that's a
   native GenLayer transaction-level action, not a Docket contract method — surface it via
   whatever `genlayer-js`/CLI primitive exposes appeals (see `genlayer-cli`'s
   `transactions appeal` / `appeal-bond` commands as the reference for what the JS SDK should
   expose; verify the JS equivalent before wiring a button to it).
5. **No pre-computed verdicts, ever.** The frontend must never call an LLM itself to show a
   client "what the verdict will probably be" and must never let that output anywhere near a
   transaction payload. It can link to the same evidence URLs for a human to read, which is
   fine and encouraged.

## Backend (optional autonomous worker agent, genlayer-py)

Deferred to `docs/10-roadmap.md` Phase 2, but designed for from day one: an autonomous agent
that watches `list_open_dockets()`, evaluates SOWs it's capable of fulfilling, claims a
docket, does the work, and calls `submit_deliverable` — all via `genlayer-py`. Verify the
current `genlayer-py` API surface (`/api-references/genlayer-py/api`) before building; do not
assume it mirrors `genlayer-js` method-for-method.

## Testing the integration layer

- `gltest` covers contract-level integration (consensus, real web/LLM calls, Studio).
- Frontend integration tests should mock `genlayer-js` client responses for unit tests, and
  run against a live Studionet deployment for a smoke-test pass before any Bradbury
  deployment — see `docs/08-testing-plan.md`.
