# 10 — Roadmap

## Phase 0 — this package (done)
Product vision, architecture, contract spec, equivalence design, security checklist, testing
plan, submission checklist, page designs, and a contract skeleton grounded in verified
GenLayer documentation. Nothing deployed yet.

## Phase 1 — audited v1 contract + frontend
- Finalize `contracts/docket.py` against the live docs MCP / SDK reference, resolving every
  `# VERIFY:` marker.
- Full green run of `docs/07-security-and-audit-checklist.md`.
- Direct tests, then integration tests, then Studionet deployment, then Bradbury deployment.
- Frontend from `design/` wired to `genlayer-js` per `docs/06-integration-plan.md`.
- Submission per `docs/09-submission-and-review-readiness.md`.

## Phase 2 — autonomous worker agents
- A `genlayer-py`-based reference worker agent that watches `list_open_dockets()`, evaluates
  fit, claims, and submits deliverables autonomously — demonstrating the actual
  agent-to-agent use case the product is built for, not just a human-operated demo.
- Optional: publish the reference agent as a template others can point at their own
  capability (e.g. "an agent that fulfills any docket whose SOW matches pattern X").

## Phase 3 — reputation interoperability
- Expose `get_reputation()` in a shape another contract can consume directly, and evaluate
  a genuine ERC-8004-style identity/reputation bridge rather than Docket's own minimal
  ledger being the only source of truth. This is deliberately deferred — reputation
  interoperability is a bigger design surface than a v1 milestone-adjudication product
  should try to solve on its own.

## Phase 4 — multi-milestone dockets
- If real usage shows single-deliverable dockets are too coarse for larger engagements,
  design a "docket series" that shares a client/worker pair and reputation trail across
  N sequential dockets, rather than complicating the core `Docket` struct. Keep the audited
  core small; compose on top of it.

## Explicitly not on the roadmap
- Turning Docket into a general dispute court, a prediction market, or a chat/analytics
  product. Every phase above stays inside the "escrow release gated on spec-compliance
  verdict" primitive this project was scoped around.
