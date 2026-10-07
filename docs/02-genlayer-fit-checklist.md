# 02 — GenLayer Fit Checklist

GenLayer's own developer docs ("When to Use GenLayer") give a five-point checklist for
whether a feature belongs in an Intelligent Contract or in a normal backend. This document
runs Docket through it explicitly, on the record, so a reviewer never has to guess why this
is on-chain.

## The checklist

| # | GenLayer's question | Docket's answer |
|---|---|---|
| 1 | Is there a real on-chain consequence? | Yes. A verdict directly triggers escrow release (full/partial/refund) and a reputation-ledger write. Nothing is decorative. |
| 2 | Does the outcome require judgment? | Yes. "Does this deliverable satisfy this natural-language Scope of Work" is not evaluable by exact-match logic. |
| 3 | Can the evidence be independently checked? | Yes, by construction: **only public evidence URLs are accepted.** Validators fetch the same repo, endpoint, or document the leader fetched. URLs are supplied at submission; fetchability is checked during adjudication, and dead links resolve toward `REJECT`. |
| 4 | Does the decision benefit from neutral consensus? | Yes. Client and worker are counterparties with no shared trusted backend — the exact scenario Optimistic Democracy exists for. |
| 5 | Can the result be made explicit? | Yes. The contract returns a structured `verdict` (`full`/`partial`/`reject`), a bounded `score` (0–100), and an `unmet_criteria` list — never open-ended prose that validators would have to eyeball for "close enough." |

All five are true, which per GenLayer's own guidance means this is a strong, not marginal,
candidate.

## Anti-patterns Docket deliberately avoids

GenLayer's docs name four specific anti-patterns. Docket's architecture was chosen to avoid
each one directly:

1. **"Frontend computes the answer, GenLayer only stores it."**
   Docket's frontend/backend never call an LLM to produce a verdict. They only collect the
   SOW text and the evidence URLs and submit them to the contract. The verdict is computed
   *inside* the leader/validator functions, independently, by GenLayer nodes — never
   pre-chewed off-chain. See `docs/03-architecture.md` §Layer Boundaries.

2. **"Generic AI brain" (chatbot/recommender/analytics with no consensus-critical state
   change).**
   Docket has exactly one AI-driven decision point: the deliverable verdict. There is no
   chat interface, no recommendation feed, no analytics dashboard inside the contract. Any
   off-chain AI assistance (e.g. helping a client draft a clearer SOW) is explicitly kept in
   the frontend/backend layer and never touches consensus.

3. **"Private data that validators cannot verify."**
   The contract's `submit_deliverable` method validates (at submission time, deterministically)
   that each evidence entry is a well-formed `https://` URL, and the leader/validator
   functions must both be able to fetch it at submission/adjudication time. A docket whose evidence is unreachable resolves
   as an `EXTERNAL_UNREACHABLE_EVIDENCE` path (see `docs/04-contract-spec.md` §Error Codes),
   resolves toward `REJECT`, and never silently passes. Screenshots (`gl.nondet.web.render`) are used only as an *additional* input
   validators can independently re-capture from the same public URL — never as a
   client-uploaded, unverifiable image.

4. **"Unbounded subjective output."**
   The verdict schema is fixed and small: an enum, a bounded integer, and a capped-length
   rationale. Validators compare the parts that matter (verdict, score) with defined
   tolerance and do not need to agree character-for-character on prose. See
   `docs/05-equivalence-and-nondeterminism.md`.

## Framing discipline

Per GenLayer's own guidance, Intelligent Contracts are *not* a court and don't make a
result legally binding by themselves. Every doc, every UI string, and every contract error
message in this project uses "adjudication," "verdict," and "settlement," and avoids
language implying legal judgment. See `docs/07-security-and-audit-checklist.md` §Framing
and Legal Language for the enforced word list.
