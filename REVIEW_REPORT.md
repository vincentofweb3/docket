# Docket Review Report

> Historical review dated 2026-08-24. The contract, tests, and checklists were subsequently
> updated. Use [`AUDIT_HANDOFF.md`](AUDIT_HANDOFF.md) for the current verified status and
> continuation procedure.

Review date: 2026-08-24

Scope completed in the requested order: `README.md`, `CLAUDE.md`, `docs/01` through
`docs/10`, `contracts/docket.py`, `tests/direct/`, `tests/integration/`, every file in
`design/`, and `frontend/README.md`. Live references were fetched to `/tmp/docket-full-documentation.txt`,
`/tmp/docket-sdk-api.txt`, `/tmp/docket-builders-resources.html`, and `/tmp/docket-portal.js`.
The current SDK reference is v0.3-oriented. Some older pages in the full documentation still
show the pre-v0.3 API; where they conflict, the current SDK migration/reference is treated as
authoritative and the conflict is recorded.

## API Verification Results

The result below resolves every `# VERIFY:` marker in `contracts/docket.py`. “Confirmed” means
the live reference supports the expression as written. “Needs change” gives the specific change
the Executor must make. “Not established” means the live references do not justify assuming the
behavior.

The `# VERIFY:` text on line 6 is only the scaffold's header instruction; it is not an API call
or unresolved implementation marker.

| Location | Result |
|---|---|
| `contracts/docket.py:63`, `ReputationRecord.score_sum: u64` | **Not established as sufficient.** `u64` is a valid sized storage type and the SDK documents sized integers, but neither live reference gives an application bound proving that a lifetime score sum cannot overflow. Keep `u64` only after documenting/enforcing a bound; otherwise change this field to `bigint` (or another explicitly justified wider type) and add an overflow test. |
| `contracts/docket.py:67-69`, deployed `class_name` | **Partially confirmed, but not definitive for the CLI/schema output.** The SDK says the one subclass of `gl.contract.Contract` is registered as the main contract, and transaction receipts expose a `class_name`; it does not require the literal name `Docket`. The Executor must generate/inspect the schema or receipt and reconcile the docs to the actual `DocketContract` name (or rename the class if the tool requires `Docket`). |
| `contracts/docket.py:97`, `:99`, `:135`, `:153`, `:185`, `:252`, `:268` | **Needs change.** `gl.message.timestamp` is not in the current SDK. The current API provides `gl.vm.get_timestamp() -> datetime`, deterministic to the transaction timestamp; convert it explicitly for the `u64` Unix fields, e.g. `int(gl.vm.get_timestamp().timestamp())`. `gl.message_raw` is also legacy; current SDK exposes message raw data through `gl.message.raw`. |
| `contracts/docket.py:106`, zero-address literal | **Confirmed-correct-as-written.** The SDK explicitly defines `Address.ZERO` as `Address("0x0000000000000000000000000000000000000000")`, and the full docs show the same literal as a zero-address sentinel. `Address.ZERO` is the clearer canonical spelling, but the literal syntax itself is valid. |
| `contracts/docket.py:181`, `:247`, `:249`, `:272`, all `gl.emit_transfer(...)` calls | **Needs change.** There is no current top-level two-argument `gl.emit_transfer`. Use `gl.chain.Account(recipient).emit_transfer(value)` for an arbitrary recipient, or the appropriate account/contract wrapper. The current method signature is `emit_transfer(value, *, on='finalized')`. |
| `contracts/docket.py:223`, `str(e) == str(leaders_res)` | **Needs change.** In the current SDK `gl.vm.UserError` carries its calldata-encodable payload in `.data`; the leader result is a `gl.vm.UserError`, not a string. Compare the documented payload/public code explicitly (normally `e.data` against `leaders_res.data`, or a deliberate `public_code` comparison), and preserve the `LLM_ERROR_*` disagreement rule. The older full docs mention `.message`, which is a migration-era conflict, not confirmation for the current SDK. |
| `contracts/docket.py:226`, `leaders_res.calldata` | **Confirmed-correct-as-written.** `gl.vm.Return.calldata` is the current documented accessor for the decoded successful sub-VM result. |
| `contracts/docket.py:289`, unbounded `TreeMap` iteration cost | **Not established.** The SDK confirms the API but gives no gas/throughput guarantee for scanning an unbounded map in a view. Obtain a gas/profile result at the expected scale or add pagination/indexing before treating this as production-ready. |
| `contracts/docket.py:291`, `self.dockets.items()` | **Confirmed-correct-as-written for the API.** `gl.storage.TreeMap.items()` is documented and returns all `(key, value)` pairs in sorted order. This does not resolve the separate scale/cost concern above. |
| `contracts/docket.py:334-335`, `gl.nondet.web.request(url)` | **Needs change.** Current signature requires the keyword-only `method`, e.g. `gl.nondet.web.request(url, method="GET")`. It returns `genlayer.nondet.web.Response(status, headers, body)`, not a body string. Read `response.status` and `response.body`, reject non-2xx and empty bodies per docs/spec, and decode/limit the body deterministically. The convenience `gl.nondet.web.get(url)` is also documented. |
| `contracts/docket.py:336`, `except Exception` around web request | **Not definitively verifiable as written.** The current API reference documents the return type but does not publish a single exhaustive exception class for transport failures. The Executor must inspect the installed SDK/runtime and catch the documented transport/timeout/rate-limit exceptions, with a deliberate final classification for any remaining VM error; do not claim that generic `Exception` is the exact API contract. |
| `contracts/docket.py:360-361`, `gl.nondet.exec_prompt(prompt, response_format="json")` | **Confirmed-correct-as-written.** Current SDK overloads document `response_format='json'` and a `dict[str, Any]` return. The existing post-call validation is still incomplete (see drift below). |

Unmarked `gl.*` calls were reviewed as well:

- `@gl.public.view`, `@gl.public.write`, and `@gl.public.write.payable` are current documented decorators.
- `gl.message.value` and `gl.message.sender_address` are current message fields.
- `from genlayer import *`, bare `gl.Contract`, bare `DynArray`, `TreeMap`, and `@allow_storage` are **legacy v0.2-style imports/names**. The current migration guide requires `import genlayer as gl`, `from genlayer.types import *`, `gl.contract.Contract`, `gl.storage.DynArray`, `gl.storage.TreeMap`, and `@gl.storage.allow`.
- `gl.vm.run_nondet_unsafe` is legacy in the current SDK. The migration guide maps old `run_nondet_unsafe` to current `gl.vm.run_nondet` (the old safe `run_nondet` became `run_nondet_default`). The full documentation still uses the old name, so the Executor must target the installed/current SDK and update docs/comments consistently.
- `gl.vm.UserError("...")` remains valid because strings are calldata-encodable, but its current payload accessor is `.data`.
- `gl.emit_transfer` at lines 247, 249, and 272 has the same invalid recipient/signature issue as line 181. Replace each with an account/contract wrapper transfer.
- `gl.vm.Return` and `leaders_res.calldata` are current.
- `gl.nondet.web.render(url, mode="text"|"html"|"screenshot")` is documented, but it is not used by this scaffold.

## Spec Drift Found

1. **Fast-path status drift (`docs/04-contract-spec.md` vs code).** The spec requires `SUBMITTED → ACCEPTED_FAST_PATH → CLOSED` and defines status `7`. `accept_deliverable()` writes `CLOSED` directly and never records `STATUS_ACCEPTED_FAST_PATH`.
2. **Escrow invariant is documented but not enforced.** `docs/07-security-and-audit-checklist.md` item 3 requires an assertion that `payout + refund == docket.amount` in every path. The code calculates both but never asserts the invariant. Add the deterministic assertion before transfers.
3. **Evidence response handling is missing.** `docs/04` and `docs/05` require non-2xx/empty-body classification, one retry for transient failures, and a dead-link path that resolves toward `REJECT`. The code stringifies the whole `Response`, does not inspect status/body, has no retry, and raises `EXTERNAL_UNREACHABLE_EVIDENCE` without a deterministic post-consensus reject fallback.
4. **Error-code drift.** `docs/05` specifies `LLM_ERROR_MALFORMED_VERDICT`; code raises `LLM_ERROR_MALFORMED_JSON`. Choose one canonical code and update both docs and code. The validator currently compares the leader error through `str(...)`, which is not the current SDK payload API.
5. **Adjudication output bounds are incomplete.** The prompt requests exact shape and bounded rationale, but code does not require an object with exactly the expected keys, does not verify `unmet_criteria` is a list of strings, and does not cap the number or length of those items. `docs/05` and `docs/07` require deterministic field validation/caps.
6. **Current SDK naming drift affects the whole contract.** Imports, storage decorators/types, base class, nondeterministic runner, timestamp access, and transfer calls are v0.2-style while the fetched SDK reference is v0.3-oriented. This is a substantive Executor change, not a documentation-only issue.
7. **`docs/05`/code runner-name drift.** The design document and code use `run_nondet_unsafe`; current SDK migration maps that exact old API to `run_nondet`. The Executor must update the design comments and security checklist wording alongside the code so the documented equivalence strategy remains auditable.
8. **Unreachable-evidence UI wording/state drift.** `design/states.html` says an unreachable evidence link “counts against the score rather than pausing,” while `docs/04`/`docs/05` say an unreachable source resolves toward reject. Align the design copy with the contract decision once the Executor chooses the final error path.
9. **Class-name pseudocode drift.** `docs/04` shows `class Contract(gl.Contract)` while the implementation uses `DocketContract`. Current docs require one registered `Contract` subclass but do not require the literal name. Update the spec to name `DocketContract` after schema verification.
10. **A statement in `docs/02-genlayer-fit-checklist.md` says evidence fetchability is rejected at docket creation, but evidence URLs are only supplied at submission.** Either move that assertion to submission/adjudication or add an explicit design mechanism; the current lifecycle cannot enforce it at creation.

## Lint Output

Command requested: `genvm-lint check contracts/docket.py --json`

Raw output:

```text
/bin/bash: line 1: genvm-lint: command not found
```

The command could not be run because `genvm-lint` is not installed in this environment. No lint errors are inferred from that failure.

## Submission Process Drift

The live Builder Resources page and the current portal JavaScript bundle were re-fetched on
2026-08-24. A direct fetch of `https://portal.genlayer.foundation/points` returned HTTP 404,
although the client-side route table contains `/points`; the bundle is therefore the evidence
for the points/submission UI details below.

- The live routes include `/builders/resources`, `/submit-contribution`, `/my-submissions`, and `/points`.
- Submission states in the current UI/API are `pending`, `accepted`, `rejected`, `canceled`, and `more_info_needed`. The UI label is **“More Info Needed”**, not the document's **“More Information Needed”**.
- New submissions require reCAPTCHA. Editing/resubmitting an existing submission bypasses the new-submission reCAPTCHA flow.
- Evidence is represented as URL-based `evidence_items`; the current form supports URL evidence, not uploaded files. This part of `docs/09` remains accurate.
- The current contribution type **Intelligent Contracts** is live and submittable, with `max_submissions_per_user_per_week: 2`, `max_points: 10`, `requires_ai_review: true`, and evidence groups requiring one of `studio-contract`/`github-repo` plus one `genlayer-explorer-contract`. The type metadata was updated 2026-08-15. `docs/09` does not include these category-specific limits/groups and should be updated before submission.
- The bundle's profile/submission flow requires a display name. Email is used by pending-account/email-verification flows, but the current authenticated submission form does not support the blanket statement that email is always required for every submission. Revise the checklist wording to distinguish profile/account verification from the submission form.
- Builder Resources currently emphasizes GenLayer Skills for coding agents, the builder journey, connecting wallet/GitHub, starring boilerplate, adding Bradbury/Asimov/Studio networks, obtaining testnet GEN, and deploying a first contract. This is additional current guidance not reflected in `docs/09`.

## Gaps Identified

Priorities are ordered for the Executor.

### P0: blocks contract trust

- Migrate `contracts/docket.py` to the current SDK API surface before any lint/test/deploy attempt.
- Resolve timestamp, transfer, response status/body, runner/error-payload, and output-bound issues listed above.
- Reconcile `docs/04`, `docs/05`, and `docs/07` with the final behavior, especially fast-path status, escrow conservation, transient retry, external-failure fallback, and the canonical malformed-output error code.
- Decide and document a bounded numeric policy for `ReputationRecord.score_sum`; the live docs do not prove `u64` is sufficient for an unbounded lifetime sum.

### P1: quality gates and security evidence

- `genvm-lint` is unavailable, so the first quality gate has no result.
- Direct tests are largely skipped skeletons. Only the pure `_split_escrow` cases are executable in the committed direct test file; lifecycle, nondeterministic error classification, expiry, reputation, and storage-typing coverage are absent.
- Integration tests are entirely skipped skeletons. There is no committed stable public evidence fixture, no live balance assertion, no unreachable-evidence consensus test, no appeal test, and no deployed-schema assertion.
- The direct and integration test files each contain unresolved harness `# VERIFY:` comments. The Executor must verify the current `genlayer-test`/`gltest` imports and fixtures rather than guessing them.
- Every row in `docs/07-security-and-audit-checklist.md` remains unchecked, including re-entrancy/runtime semantics, escrow conservation, prompt-injection re-fetch, dependency pin verification, and failed-transaction debugging evidence.

### P2: integration/frontend/submission readiness

- No frontend application, typed contract/network/schema config, generated schema, deployment address, transaction evidence, or public demo exists. This is consistent with `frontend/README.md`'s intentional sequencing, but it remains required before submission.
- The appeal page design exists, but the JS SDK appeal primitive is still explicitly unresolved in `frontend/README.md`/`docs/06-integration-plan.md`.
- Page-design coverage is complete: all 13 screens named by `frontend/README.md` and `docs/06-integration-plan.md` have corresponding files in `design/`. `states.html` and `components.html` are correctly reference-component designs, not missing routes.
- Update `docs/09-submission-and-review-readiness.md` with current Intelligent Contracts category limits/evidence groups, the current status label, URL-only evidence, reCAPTCHA behavior, and the display-name/email nuance.
- CLAUDE.md requires the pinned `Depends` hash to be re-confirmed immediately before deployment, the schema to be generated/inspected before frontend work, and receipt/schema/code/read-call debugging evidence for failed transactions. None of those supporting artifacts exists yet; they are Executor-stage deliverables.

## Files Added or Corrected By This Review

- `REVIEW_REPORT.md` — added this review report with live API verification, spec drift, lint availability, submission-process drift, gaps, and the Executor handoff order.

No production logic, tests, design files, or frontend files were modified.

## Ready for Executor

1. **First:** update `contracts/docket.py` imports, storage decorators/types, base class, timestamps, and all transfer calls to the current SDK reference; resolve `score_sum` and class-name policy at the same time. Update the corresponding API comments in `docs/04`, `docs/05`, and `docs/07`.
2. **Second:** repair `_run_adjudication()` in `contracts/docket.py` to call `web.request(..., method="GET")`, inspect `Response.status`/`body`, implement the documented one-retry/transient and external-failure classification, and enforce bounded `unmet_criteria`/rationale/output shape. Keep all storage and transfers outside the nondeterministic block.
3. **Third:** replace `run_nondet_unsafe` with the current runner, compare `UserError.data`/public codes explicitly, and preserve the documented `LLM_ERROR_*` disagreement behavior. Reconcile the canonical malformed-output error code across `contracts/docket.py`, `docs/04-contract-spec.md`, and `docs/05-equivalence-and-nondeterminism.md`.
4. **Fourth:** fix deterministic lifecycle/accounting in `contracts/docket.py`: record `STATUS_ACCEPTED_FAST_PATH` before closing, assert `payout + refund == docket.amount`, and align unreachable-evidence settlement and reputation semantics with `docs/04`, `docs/05`, and `docs/07-security-and-audit-checklist.md`.
5. **Fifth:** verify the current direct-test harness and replace the skipped cases in `tests/direct/test_docket_direct.py`; add stable public evidence and implement the integration cases in `tests/integration/test_docket_integration.py`. Run the gates in CLAUDE.md order: lint, direct tests, then integration tests.
6. **Sixth:** perform the required schema/deployment checks only after the contract gates are green; capture `genlayer receipt`, `schema`, `code`, and read-call evidence as required by `CLAUDE.md`.
7. **Seventh:** update `docs/09-submission-and-review-readiness.md` from the live portal findings, then assemble the required public repository, contract, explorer, finalized-transaction, test, and frontend-demo URLs. Do not submit until the security checklist is actually checked and the current Intelligent Contracts evidence groups/limits are satisfied.
8. **Eighth:** only after the contract/schema/deployment prerequisites are complete, scaffold the frontend from `frontend/README.md` and `docs/06-integration-plan.md`, including the real GenLayer transaction lifecycle and a verified native appeal primitive.

The review pass is complete. The project is ready to hand to the Executor; no contract
implementation, new-logic validation run, or network deployment was started by this review.
