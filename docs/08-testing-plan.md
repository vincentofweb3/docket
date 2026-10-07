# 08 — Testing Plan

Two tiers, matching GenLayer's own tooling: fast in-memory **direct tests** (`pytest
tests/direct/`) with mocked web/LLM calls, and full-consensus **integration tests** (`gltest
tests/integration/`) against Studio/GLSim/StudioNet/Bradbury. Direct tests must be green
before integration tests are attempted; integration tests must be green before any Bradbury
deployment.

## Direct test matrix (`tests/direct/test_docket_direct.py`)

| Area | Cases |
|---|---|
| Docket creation | Rejects `value == 0`; rejects empty `sow_text`/`acceptance_criteria`; rejects `threshold_bp > 10000`; rejects past/now `deadline`; happy path assigns sequential `docket_id`s and status `OPEN`. |
| Claiming | Rejects claim by the client themself; rejects claim on non-`OPEN` docket; rejects claim after deadline; happy path sets `worker` and status `CLAIMED`. |
| Submission | Rejects empty evidence list; rejects a non-`https://` URL; rejects submission by a non-assigned address; rejects submission after deadline; happy path sets status `SUBMITTED`. |
| Fast-path acceptance | Rejects if called by non-client; rejects if not `SUBMITTED`; happy path pays worker 100%, updates both reputations, status `CLOSED`. |
| Dispute — mocked adjudication | With mocked `leader_fn`/`validator_fn` returning `full`/`partial`/`reject`, confirm `_split_escrow` output for each, including `partial` exactly at, just above, and just below `threshold_bp`. |
| Error classification | Mocked `EXPECTED_*`, `EXTERNAL_*`, `TRANSIENT_*`, `LLM_ERROR_*` leader outcomes each produce the validator behavior documented in `docs/05-equivalence-and-nondeterminism.md` §Error classification. |
| Expiry/refund | `refund_expired` succeeds from any address once past deadline on `OPEN`/`CLAIMED`; rejects before deadline; rejects if already `SUBMITTED` or later. |
| Reputation | `_update_reputation` correctly increments `completed`/`disputed`/`upheld`/`score_sum` for both client and worker across a `full`, a `partial`, and a `reject` resolution. |
| Storage typing | A test that instantiates `Docket`/`ReputationRecord` and confirms no bare `dict`/`list` sneaks in (defense in depth on top of the linter). |

## Integration test matrix (`tests/integration/test_docket_integration.py`)

| Area | Cases |
|---|---|
| Full lifecycle, fast path | Deploy → create → claim → submit → accept. Confirm final on-chain balances via the RPC, not just contract state. |
| Full lifecycle, disputed — real evidence | Deploy → create with a real public URL fixture (e.g. a stable GitHub raw file or a small hosted fixture page committed to this repo) → claim → submit → dispute → confirm verdict resolves and escrow splits correctly against real validator consensus on Studio/StudioNet. |
| Unreachable evidence | Submit a deliberately dead URL, dispute, confirm the contract resolves toward `REJECT` rather than hanging or silently passing. |
| Appeal flow | Confirm a disputed, `ACCEPTED` verdict can be appealed within the finality window using the native GenLayer appeal mechanism, and that appealing re-triggers a larger-validator-set re-evaluation rather than a Docket-specific code path (there shouldn't be one — this is the point of relying on Optimistic Democracy natively). |
| Deadline/expiry against real block time | Confirm `refund_expired` behaves correctly against actual network time on the target testnet, not just a mocked clock. |
| Deployment sanity | `genlayer deploy` → `genlayer schema <address>` → confirm schema matches `docs/04-contract-spec.md` exactly (method names, param types, return types). |

## What is intentionally not tested in v1

- Load/throughput testing of `list_open_dockets()` at scale — flagged as a `# VERIFY:` open
  question in `docs/04-contract-spec.md`, to be resolved with a real test once realistic
  docket volumes are known, not guessed at now.
- Multi-milestone dockets — out of scope per `docs/04-contract-spec.md` §Non-goals.

## Evidence to keep from test runs

Keep the raw output of the final green `pytest tests/direct/ -v` and `gltest
tests/integration/ -v -s` runs (terminal output or CI logs) — `docs/09-submission-and-review-readiness.md`
asks for a link to this evidence, and GenLayer's steward review process only accepts URL
evidence, not file uploads, so plan to publish these as part of the repo (e.g. a `CI` badge
or a committed log/CI run link) rather than a local screenshot.
