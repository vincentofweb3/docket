# 09 — Submission & Review Readiness

This document is grounded in how GenLayer's own Points/Builder submission process actually
works today (re-fetched 2026-08-25 from the live portal bundle and builder resources), not assumptions:

- All contributions go through a **steward review queue**. Current states are `pending`,
  `accepted`, `rejected`, `canceled`, and **More Info Needed**. A steward can ask for more
  evidence and an existing submission can then be edited.
- **File uploads are disabled.** All evidence must be provided as URLs. This means the
  entire submission has to be independently verifiable by a steward clicking links — nothing
  can rely on an attached screenshot or a private doc.
- The profile flow requires a display name. Email is used by account/email-verification flows,
  but the authenticated submission form does not establish that email is required for every
  submission.
- reCAPTCHA is required on new submissions; editing/resubmitting an existing submission bypasses
  the new-submission reCAPTCHA flow.
- The live **Intelligent Contracts** contribution type allows 2 submissions per user per week,
  has a 10-point maximum, requires AI review, and requires evidence in both groups:
  `studio-contract` or `github-repo`, plus `genlayer-explorer-contract`.

Given that, here is exactly what to have ready **before** submitting Docket for review —
treat this as a pre-flight checklist, not a suggestion.

## Evidence links to have ready

| Evidence | Where it comes from | Status |
|---|---|---|
| Public source repository URL | GitHub, pushed and public | **EVIDENCED — <https://github.com/vincentofweb3/docket>** (public, pushed 2026-10-07) |
| README rendered on the repo's default branch, matching this project's `README.md` | Same repo | **EVIDENCED — <https://github.com/vincentofweb3/docket>**, default branch `master` |
| Deployed contract address on a named GenLayer network | `genlayer-js deployContract` on Studionet | **EVIDENCED — `0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B`**, deployed code byte-identical to `contracts/docket.py`. See [`evidence/studionet-deployment-2026-10-07.txt`](../evidence/studionet-deployment-2026-10-07.txt) |
| Explorer link for that contract address | Studionet explorer | **EVIDENCED — <https://explorer-studio.genlayer.com/address/0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B>** |
| At least one finalized on-chain transaction demonstrating the full lifecycle, and ideally one disputed → resolved | Explorer transaction links | **EVIDENCED — two complete lifecycles (9 transactions, all status=FINALIZED).** Fast path settled `FULL`/100; a disputed docket was adjudicated by AI validator consensus to `REJECT`/10 with three specific unmet criteria. All hashes and per-tx explorer links are listed in the deployment evidence file |
| Passing test evidence | A CI run link or a committed log referenced from the README | **EVIDENCED — lint `ok: true` (9 methods), 29/29 direct tests, Studionet integration 5 passed / 1 skipped, exit 0.** Logs: [`evidence/lint-studionet-2026-10-07.json`](../evidence/lint-studionet-2026-10-07.json), [`evidence/direct-tests-studionet-2026-10-07.txt`](../evidence/direct-tests-studionet-2026-10-07.txt), [`evidence/integration-studionet-2026-10-07.txt`](../evidence/integration-studionet-2026-10-07.txt) |
| Live or locally-runnable frontend demo link | Hosting platform of choice | BLOCKED — frontend not yet scaffolded; the deployment/schema prerequisite is now met |
| Short written description of the use case, in the vocabulary of `docs/02-genlayer-fit-checklist.md` (adjudication, evidence, verdict — not "AI moderator" or "bet") | This repo's README/vision doc | EVIDENCED — README.md and docs/01–02 use the required adjudication vocabulary and explicit non-goals |

### Disclose these limitations in the submission text

A steward will read the evidence, and these are the gaps that could read as overselling. State
them plainly rather than letting a reviewer discover them:

- **Payout to a recipient wallet is not demonstrated.** On Studionet the escrow correctly leaves
  the contract and the contract settles to `0x0`, but the emitted payout to a worker EOA
  finalizes with an execution error, so the recipient is never credited. Studionet has no EVM
  layer or ghost contracts. Re-verification on Bradbury is required before claiming that GEN
  moves. Evidence: [`evidence/studionet-fund-trace-2026-10-07.json`](../evidence/studionet-fund-trace-2026-10-07.json).
- **The appeal flow is untested.** `gen_appealTransaction`, `gen_getAppealCharge` and
  `gen_canAppeal` do not exist on Studionet, so that test skips with a stated reason. Claiming
  a working appeal path from this evidence would be false.
- One integration case asserts contract-side escrow conservation but not worker credit, and prints
  a NOTICE on every run. See `_eoa_credit_supported` in
  `tests/integration/test_docket_integration.py`.

## Before submitting, re-verify

1. **Re-fetch the live builder resources / submission pages** at
   `https://portal.genlayer.foundation/builders/resources` and the Points "Submitting
   Contributions" guide immediately before submitting — submission requirements, contribution
   type taxonomy, and best-practice guidance can change. Re-fetch again immediately before
   submission.
2. Confirm every link in the checklist above actually resolves for someone who is not
   logged into your accounts — a steward reviewing from a link with no special access should
   see exactly what you intend them to see.
3. Confirm the profile submitting the contribution has a display name and complete account
   verification, plus connected GitHub/wallet if relevant. Email requirements depend on the
   account-verification flow rather than applying uniformly to the submission form.
4. Re-read `docs/07-security-and-audit-checklist.md` and make sure every row is checked
   (not just reviewed) — a security-conscious steward will look for exactly these gaps
   (fund-safety invariants, prompt-injection defenses, storage typing) and an unresolved
   `# VERIFY:` in shipped code reads as unfinished work.
5. Make sure nothing in the repo, README, or demo describes Docket as a prediction market,
   a court, or a legally binding arbitrator — see the framing rules in
   `docs/02-genlayer-fit-checklist.md` and `docs/07-security-and-audit-checklist.md`.

## If a submission comes back "More Info Needed"

Treat it as a request for a more specific URL, not a rejection. Go back to the evidence
table above, figure out which row the steward's question maps to, and tighten that one
link (e.g. link the specific transaction hash instead of a generic explorer homepage; link
the specific test log line instead of "tests pass, trust me"). Resubmit through the same
flow — editing a submission in this state does not require a fresh reCAPTCHA per the
documented process.
