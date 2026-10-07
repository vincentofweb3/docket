# 04 — Contract Specification

This is the authoritative spec for `contracts/docket.py`. Anything the skeleton does that
contradicts this file is a bug in the skeleton, not a spec change — update this file first
if the design needs to change, then the code.

> **SDK note:** the contract uses the v0.3 API surface: `import genlayer as gl`,
> `gl.contract.Contract`, `gl.storage.allow`, `gl.storage.DynArray`/`TreeMap`,
> `gl.vm.get_timestamp()`, `gl.vm.run_nondet()`, and `gl.chain.Account.emit_transfer()`.

## Storage

```python
@allow_storage
@dataclass
class Docket:
    client: Address
    worker: Address                # zero address until claimed
    sow_text: str                  # full natural-language Scope of Work
    acceptance_criteria: str       # bullet-style, structured-as-possible criteria
    threshold_bp: u32              # minimum score (0-10000 basis points) to count as "partial" pass
    amount: bigint                 # escrowed GEN, smallest unit
    deadline: u64                  # unix timestamp, worker must submit before this
    status: u8                     # see Status enum below
    evidence: DynArray[str]        # public https URLs, filled at submission
    note: str                      # worker's free-text note, informational only, never adjudicated directly
    verdict: u8                    # see Verdict enum, 0 = none yet
    score: u32                     # 0-100, filled once resolved
    unmet_criteria: DynArray[str]  # filled once resolved, if verdict != full
    created_at: u64
    resolved_at: u64

@allow_storage
@dataclass
class ReputationRecord:
    completed: u32
    disputed: u32
    upheld: u32                    # disputes where this address's claimed position matched the verdict
    score_sum: bigint              # arbitrary-precision running sum, divide by `completed` for average
```

```python
class DocketContract(gl.contract.Contract):
    dockets: TreeMap[u32, Docket]
    next_docket_id: u32
    reputation: TreeMap[Address, ReputationRecord]
```

### Status enum (`u8`)
`0 OPEN` · `1 CLAIMED` · `2 SUBMITTED` · `3 ADJUDICATING` · `4 RESOLVED` · `5 CLOSED` ·
`6 EXPIRED` · `7 ACCEPTED_FAST_PATH`

### Verdict enum (`u8`)
`0 NONE` · `1 FULL` · `2 PARTIAL` · `3 REJECT`

## Public methods

| Method | Type | Description |
|---|---|---|
| `create_docket(sow_text: str, acceptance_criteria: str, threshold_bp: u32, deadline: u64) -> u32` | `write.payable` | Escrows `gl.message.value` as the docket's `amount`. Returns the new `docket_id`. Reverts (`UserError`) if `sow_text` or `acceptance_criteria` is empty, `threshold_bp > 10000`, `deadline` is not in the future, or `value == 0`. |
| `claim_docket(docket_id: u32)` | `write` | Sets `worker = gl.message.sender_address`, status `OPEN → CLAIMED`. Reverts if not `OPEN`, if caller is the client, or if `deadline` has passed. |
| `submit_deliverable(docket_id: u32, evidence: list[str], note: str)` | `write` | Deterministically validates every URL starts with `https://` and the list is non-empty (`UserError` `EXPECTED_EMPTY_EVIDENCE` / `EXPECTED_INVALID_URL` otherwise). Sets status `CLAIMED → SUBMITTED`. Reverts if caller isn't the assigned worker, or past deadline. |
| `accept_deliverable(docket_id: u32)` | `write` | Client-only fast path. Status `SUBMITTED → ACCEPTED_FAST_PATH`, immediately releases 100% of escrow to worker, updates reputation for both addresses, status `→ CLOSED`. |
| `dispute_deliverable(docket_id: u32)` | `write` | Client-only. Status `SUBMITTED → ADJUDICATING`, runs the non-deterministic adjudication block (see `05-equivalence-and-nondeterminism.md`), then deterministically applies the verdict, splits escrow, updates reputation, status `→ RESOLVED → CLOSED`. |
| `refund_expired(docket_id: u32)` | `write` | Anyone can call once `deadline` has passed with status still `OPEN` or `CLAIMED`. Refunds escrow to client, status `→ EXPIRED`. Permissionless by design, matching GenLayer's own `validatorPrime()`-style pattern of not gating maintenance calls behind a single caller. |
| `get_docket(docket_id: u32) -> Docket` | `view` | Full docket record. |
| `get_reputation(addr: Address) -> ReputationRecord` | `view` | Reputation lookup for UI and for other contracts to read. |
| `list_open_dockets() -> DynArray[u32]` | `view` | IDs with status `OPEN`, for a browse/marketplace UI. The v1 view scans the sorted `TreeMap`; production scale must be profiled before unbounded use. |

## Error codes

Every raised `gl.vm.UserError` message is a short, machine-parseable, prefixed string so a
frontend can map it to copy and so validator functions can classify disagreement correctly
(see `docs/05-equivalence-and-nondeterminism.md` §Error Classification):

| Prefix | Meaning | Validator handling |
|---|---|---|
| `EXPECTED_*` | Deterministic business-rule violation (bad input, wrong caller, wrong status, wrong timing) | Must match exactly between leader and validator — if the leader errors with `EXPECTED_*`, a correct validator errors identically. |
| `EXTERNAL_*` | Evidence URL unreachable, returned non-2xx, or empty body | Deterministic across validators for a genuinely dead URL; treated as `EXPECTED` for equivalence purposes once confirmed by the validator's own fetch. |
| `TRANSIENT_*` | Timeout or rate-limit on an otherwise-reachable evidence source | Both leader and validator hitting the same transient condition is plausible; one retry is allowed before falling back to `EXTERNAL_*`. |
| `LLM_ERROR_*` | Malformed/non-JSON model output, or a field outside the allowed enum | Never silently accepted — a validator that gets a clean structured result while the leader errored should vote to disagree, forcing leader rotation, per GenLayer's own documented guidance for this exact situation. The canonical malformed-shape code is `LLM_ERROR_MALFORMED_VERDICT`. |

## Events / messages

- Docket does not need cross-contract messaging in v1. `gl.chain.Account(...).emit_transfer(value=...)` is used only for
  the GEN payouts described in `docs/03-architecture.md` §Money flow. If a future version
  integrates with an ERC-8004 identity contract, that call happens in deterministic code
  after the verdict is finalized, via `gl.contract.get_at()` — never inside a nondet block.

## Explicit non-goals for v1 (see `docs/10-roadmap.md` for later phases)

- No partial-evidence resubmission flow (a disputed docket that fails on `EXTERNAL_*` simply
  resolves `REJECT` and refunds — the worker can be told to fix the link and the client can
  re-open a new docket; this keeps the state machine small for the audited v1).
- No on-chain protocol fee by default (constant present, set to zero).
- No multi-milestone dockets (one docket = one deliverable = one verdict). Multi-milestone
  is a v2 feature built as N dockets sharing a reputation history, not a single more complex
  contract.
