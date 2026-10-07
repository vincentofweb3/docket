# 07 — Security & Audit Checklist

This file is a checklist, not an essay. Every box should be checked, with a note on how it
was verified, before this project is deployed anywhere beyond Studionet, and before it is
submitted anywhere for review. Update the "Status" column as work proceeds — don't delete
rows once checked, so a reviewer can see what was verified and how.

## Fund safety

| # | Check | Status |
|---|---|---|
| 1 | Escrowed `value` is only ever moved by `emit_transfer()` calls in deterministic code, never inside `leader_fn`/`validator_fn`. | EVIDENCED — `contracts/docket.py:158-168,209-244,255-257`; [lint](/home/vincent/projects/docket/evidence/lint.json) |
| 2 | `_split_escrow` is a pure function with unit tests covering `full`, `partial` above/below `threshold_bp`, and `reject`, including boundary values (`score == threshold_bp/100` exactly). | EVIDENCED — five `TestSplitEscrowPureFunction` tests in [direct log](/home/vincent/projects/docket/evidence/direct-tests.txt) |
| 3 | Total of `payout + refund` is asserted equal to `docket.amount` in every code path — no dust silently retained or silently overpaid. | EVIDENCED — `contracts/docket.py:163,233,255,299-301`; escrow tests above |
| 4 | `create_docket` reverts on `value == 0`; no docket can exist with zero economic stakes that would make disputing costless/meaningless for a leader to game. | EVIDENCED — `TestDocketCreation::test_rejects_zero_value` |
| 5 | `refund_expired` is permissionless (anyone can call it) but only ever pays the original client, never the caller — confirmed to match the "permissionless but funds go to the rightful party" pattern GenLayer itself uses for `validatorPrime()`/staking claims. | EVIDENCED — `contracts/docket.py:247-257`; `TestExpiryAndTyping::test_refund_expired_is_permissionless` |
| 6 | No method allows a status transition backward (e.g. `RESOLVED → SUBMITTED`) — enforced by explicit status checks at the top of every state-changing method, not just implied by call order. | EVIDENCED — guards at `contracts/docket.py:116,130,153,173,249`; wrong-status direct tests |
| 7 | Re-entrancy: GenVM message transfers are emitted after state effects; fast-path and dispute paths set `ACCEPTED_FAST_PATH`/`RESOLVED` before transfers, and expiry sets `EXPIRED` before its transfer. | EVIDENCED — state-before-transfer ordering at `contracts/docket.py:158-168,234-239,255-257` |

## Non-determinism / consensus integrity

| # | Check | Status |
|---|---|---|
| 8 | Every `gl.nondet.*` call is inside a `leader_fn`/`validator_fn` passed to `gl.vm.run_nondet` (or a documented convenience wrapper) — verified by `genvm-lint`, which statically catches this. | EVIDENCED — [lint `ok:true`](/home/vincent/projects/docket/evidence/lint.json); `contracts/docket.py:184-213,328-404` |
| 9 | No storage write, contract call, or message emission occurs inside a nondet block — verified by `genvm-lint` and by manual review of `dispute_deliverable`. | EVIDENCED — nondet closures only return/compare; writes start at `contracts/docket.py:224` |
| 10 | The equivalence strategy for the adjudication step matches `docs/05-equivalence-and-nondeterminism.md` exactly — categorical `verdict` strict, numeric `score` tolerance-based, `rationale`/`unmet_criteria` not gating consensus. | EVIDENCED — `contracts/docket.py:200-207`; `TestAdjudication::test_structured_result_is_bounded_and_uses_response_body` |
| 11 | Malformed LLM output (`LLM_ERROR_*`) is designed to force leader rotation via validator disagreement, not to be silently coerced into a default verdict. | EVIDENCED — `contracts/docket.py:195-198,355-379`; `TestAdjudication::test_malformed_llm_output_uses_canonical_error` |
| 12 | Evidence fetch failures are classified `EXTERNAL_*`/`TRANSIENT_*` per the table in `docs/04-contract-spec.md`, with the retry-once rule for `TRANSIENT_*` implemented exactly once (no unbounded retry loop that could be used to stall consensus or burn gas). | EVIDENCED — bounded two-attempt loop at `contracts/docket.py:384-406`; `TestAdjudication::test_unreachable_evidence_resolves_toward_reject` |

## Prompt injection

| # | Check | Status |
|---|---|---|
| 13 | The adjudication prompt clearly delimits trusted instruction text (SOW, acceptance criteria, output schema) from untrusted evidence content, using an explicit tag boundary. | EVIDENCED — `contracts/docket.py:332-350`; structured-result direct test |
| 14 | The prompt explicitly instructs the model to treat any instruction-like text found inside evidence content as data, not as a command. | EVIDENCED — explicit instruction at `contracts/docket.py:335-337` |
| 15 | The requested `response_format`/schema is fixed in the prompt template and never derived from, or overridable by, evidence content. | EVIDENCED — fixed shape and `response_format="json"` at `contracts/docket.py:349-353` |
| 16 | Evidence content length is capped deterministically (by character count, computed in ordinary Python before the nondet block or at its very start) so the prompt can't be blown out or the real criteria buried by a long adversarial page. | EVIDENCED — `MAX_EVIDENCE_CHARS_PER_ITEM=6000`; slice at `contracts/docket.py:402` |
| 17 | This checklist was cross-checked against GenLayer's own published prompt-injection guidance at `/developers/intelligent-contracts/security-and-best-practices/prompt-injection` — re-fetch and compare before finalizing, since this is exactly the kind of page whose guidance could have changed. | EVIDENCED — live docs re-fetched 2026-08-25; [guidance note](/home/vincent/projects/docket/evidence/security-guidance.txt) |

## Storage & typing

| # | Check | Status |
|---|---|---|
| 18 | No raw Python `dict` or `list` used for persistent state — only `TreeMap`, `DynArray`, and `@gl.storage.allow` dataclasses, per `docs/04-contract-spec.md`. | EVIDENCED — storage declarations at `contracts/docket.py:35-67`; `TestExpiryAndTyping::test_storage_records_have_explicit_collection_types` |
| 19 | All money fields use a sized/arbitrary-precision integer type (`bigint` or a confirmed sized type), never plain Python `int`, for anything that persists. | EVIDENCED — `Docket.amount: bigint` at line 43; [schema](/home/vincent/projects/docket/evidence/studionet-schema.json) |
| 20 | The contract uses `bigint` for persisted GEN amounts and lifetime `score_sum`; all v0.3 API markers in `contracts/docket.py` have been resolved. | EVIDENCED — lines 43/61; `rg '# VERIFY:' contracts/docket.py` has no matches; lint clean |
| 21 | Every `@gl.storage.allow` dataclass has explicit, fully-specified generic types (no bare `list`/`dict` inside a dataclass field either). | EVIDENCED — `DynArray[str]`, `TreeMap[u32,Docket]`, `TreeMap[Address,ReputationRecord]`; storage typing direct test |

## Access control

| # | Check | Status |
|---|---|---|
| 22 | Every write method checks `gl.message.sender_address` against the expected role (client-only, worker-only, or permissionless-by-design) at the top of the method, before any other logic. | EVIDENCED — role guards at `contracts/docket.py:116-122,130-136,153-156,173-176`; direct access-control tests |
| 23 | A client cannot claim their own docket (`claim_docket` explicitly rejects `sender == docket.client`). | EVIDENCED — `TestClaiming::test_rejects_client_claiming_own_docket` |
| 24 | `accept_deliverable` and `dispute_deliverable` are both client-only and both reject if called twice (status guard). | EVIDENCED — source guards at lines 153-156/173-176; accept non-client and wrong-status tests |

## Framing and legal language

| # | Check | Status |
|---|---|---|
| 25 | No contract error message, UI string, or doc implies Docket verdicts are legally binding on their own — reviewed against `docs/02-genlayer-fit-checklist.md` §Framing discipline. | EVIDENCED — [framing scan](/home/vincent/projects/docket/evidence/framing-scan.txt); UI explicitly disclaims legal effect |
| 26 | Terminology stays in {docket, scope of work, deliverable, evidence, verdict, adjudication, escrow}; prediction-market terms appear only in explicit non-goal/disclaimer copy. | EVIDENCED — [framing scan](/home/vincent/projects/docket/evidence/framing-scan.txt); no contract API/error uses prediction-market vocabulary |

## Deployment hygiene

| # | Check | Status |
|---|---|---|
| 27 | Contract `Depends` header is a pinned hash, re-confirmed as current against the docs MCP immediately before each deployment, never `latest`. | EVIDENCED — live docs contain the pinned hash; [pin note](/home/vincent/projects/docket/evidence/dependency-pin.txt); lint's newer-runner warning is recorded |
| 28 | Deployment order followed: Studionet (gasless, `0 GEN` expected) → Localnet if needed → Bradbury only once direct + integration tests are green. | PARTIAL/BLOCKED — Studionet was attempted first and remains blocked by TLS/DNS. The documented Localnet fallback now reaches assertions: 4/6 pass, while real-evidence adjudication and appeal are blocked by OpenAI HTTP 401. Bradbury/frontend were not started; [Localnet evidence](/home/vincent/projects/docket/evidence/localnet-blocker.txt) |
| 29 | Any failed transaction is debugged in the documented order — `genlayer receipt` → `genlayer schema` → `genlayer code` → read calls — before code is changed, and that trace is kept as evidence for `docs/09-submission-and-review-readiness.md`. | PARTIAL/BLOCKED — the unverified Studionet envelope remains non-evidence because consensus/address/schema/code/read checks could not complete; [Studionet trace](/home/vincent/projects/docket/evidence/studionet-blocker.txt). Localnet receipts and server output isolate the remaining failure to provider HTTP 401, and the deployed-schema assertion passes; [full Localnet run](/home/vincent/projects/docket/evidence/localnet-integration-2026-08-27T010044Z.txt) |

## Sign-off

This checklist should be re-run (not just re-read) after any change to `contracts/docket.py`
that touches escrow accounting, the adjudication prompt, or access control. Record the date,
commit hash, and who/what ran it here:

| Date | Commit | Run by | Result |
|---|---|---|---|
| 2026-08-25 | Git commit unavailable (`.git` is empty); contract SHA-256 `105934edbc32b324c94cc74d8da8c533fa93505c98ed4d24079a087c3ed9a0fe` | Codex Executor | Contract/security rows evidenced; deployment rows 28–29 blocked by Studionet TLS |
| 2026-08-27 | Git commit unavailable (`.git` is empty); contract SHA-256 `105934edbc32b324c94cc74d8da8c533fa93505c98ed4d24079a087c3ed9a0fe` | Codex Executor | Lint and 29 direct tests pass; Localnet 4/6 passes with schema/balance/expiry evidence; two LLM cases blocked by provider HTTP 401; Studionet DNS unresolved |
