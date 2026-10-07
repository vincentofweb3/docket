# Docket Frontend (planned — not yet scaffolded)

This directory intentionally does not contain a running app yet. Do not `npx create-next-app`
here until `contracts/docket.py` is deployed to at least Studionet and its schema has been
generated — see `docs/06-integration-plan.md` for the full rationale and sequencing.

## When you're ready to scaffold

```bash
npm install genlayer-js
# then follow the GenLayer project boilerplate's frontend structure as a reference:
# https://github.com/genlayerlabs/genlayer-project-boilerplate
```

## Screens to build (see `design/` for the visual spec of each)

| Screen | Design file | Reads | Writes |
|---|---|---|---|
| Marketing landing | `design/index.html` | — (static marketing content) | — |
| Connect wallet / onboarding | `design/connect-wallet.html` | — | wallet connection only, no contract call |
| Browse open dockets | `design/landing.html` | `list_open_dockets`, `get_docket` per id | — |
| Single docket detail | `design/docket-detail.html` | `get_docket`, `get_reputation` (poster) | `claim_docket` |
| Create a docket | `design/create-docket.html` | — | `create_docket` |
| Submit a deliverable | `design/submit-deliverable.html` | `get_docket` | `submit_deliverable` |
| My Dockets dashboard | `design/my-dockets.html` | `get_docket` for each id the connected address appears in as client or worker | — (links out to the relevant action screen per row) |
| Adjudicating (waiting state) | `design/adjudicating.html` | transaction status via the real GenLayer lifecycle (pending/proposing/committing/revealing/accepted/finalized) | — |
| Adjudication / dispute result | `design/adjudication-result.html` | `get_docket`, `get_reputation` | `accept_deliverable`, `dispute_deliverable` |
| Appeal | `design/appeal.html` | transaction/appeal status | native GenLayer appeal transaction (see `genlayer-cli`'s `transactions appeal`/`appeal-bond` as the reference; confirm the JS SDK equivalent) |
| Reputation / profile | `design/reputation.html` | `get_reputation` | — |
| Empty & error states (reference) | `design/states.html` | n/a — component reference | n/a |
| Transaction status component (reference) | `design/components.html` | n/a — component reference | n/a |

`states.html` and `components.html` aren't standalone routes — they're the reusable
building blocks (empty states, error banners, the transaction-status toast/modal) every
screen above should use consistently, so build those two components first.

## Non-negotiable rules for this frontend (see `docs/06-integration-plan.md` for why)

- Never call an LLM client-side to pre-compute or preview a verdict.
- Always show the real transaction lifecycle (submitted → pending → accepted → finalized,
  with a distinct failed/undetermined state) — never a generic spinner for a write call.
- Keep contract address, network config, and the deployed schema in one typed config module.
- Verify every `genlayer-js` method name against the SDK reference before using it.
