# 05 — Equivalence Principle & Non-Determinism Design

This is the single most important design document in the project. Docket's entire value
proposition rests on validators being able to independently reach the same structured
verdict on a qualitative question. Getting the equivalence strategy wrong either makes
disputes deadlock (`Undetermined`) constantly, or makes them trivially manipulable by a
leader. Read this before touching `dispute_deliverable()`.

## Why not the simple options

GenLayer documents three baseline strategies. None fits `dispute_deliverable()` alone:

- **`strict_eq`** — requires byte-identical output across validators. Explicitly documented
  as unsuitable for LLM calls, which is the entire adjudication step. Ruled out.
- **`prompt_comparative`** (convenience wrapper) — good for numeric/objective outputs
  compared with a margin of error (e.g. an average rating). Our output isn't a single
  number; it's a structured object with a categorical field. Ruled out on its own, but the
  *pattern* it embodies (leader and validator both do the task, then compare with tolerance)
  is exactly right for the `score` field.
- **`prompt_non_comparative`** (convenience wrapper) — validators grade the leader's output
  against criteria without repeating the task. Good for the softer "does the rationale make
  sense" check, but too permissive to gate money movement on by itself: a validator could
  wave through a leader's fabricated verdict without ever fetching the evidence itself.
  Ruled out as the primary mechanism, kept as a secondary sanity check (see below).

## Docket's approach: a custom leader/validator pair (`gl.vm.run_nondet`)

Both the leader and every validator independently:

1. Fetch every evidence URL in `docket.evidence` via `gl.nondet.web.request(url, method="GET")` (or
   `gl.nondet.web.render` when a rendered/screenshotted view is more informative than raw
   HTML/JSON). The current `Response.status` and `Response.body` fields are inspected;
   transient transport/status failures are retried once, then classified as
   `EXTERNAL_UNREACHABLE_EVIDENCE`.
2. Build a prompt containing: the `sow_text`, the `acceptance_criteria`, and the fetched
   evidence content (truncated/summarized deterministically by length, not by another LLM
   call, to keep prompt construction itself deterministic).
3. Call `gl.nondet.exec_prompt(prompt, response_format="json")` requesting exactly:
   ```json
   {"verdict": "full" | "partial" | "reject", "score": 0-100, "unmet_criteria": ["..."], "rationale": "<= 280 chars"}
   ```
4. Parse and validate the JSON deterministically (bounds-check `score`, check `verdict` is
   one of the three allowed values, cap list/string lengths). A parse or bounds failure
   raises `gl.vm.UserError("LLM_ERROR_MALFORMED_VERDICT")` **inside** the nondet function —
   this is a normal, expected failure mode to design for, not an edge case to ignore.

### Comparison logic (the validator function)

```python
def validator_fn(leaders_res):
    if not isinstance(leaders_res, gl.vm.Return):
        # Leader errored. Run our own attempt and see if we land on the same
        # error class — see "Error classification" below.
        ...
    my_result = leader_fn()  # validator repeats the full fetch + prompt independently

    # 1. Categorical field: must match exactly. This is the load-bearing decision.
    if my_result["verdict"] != leaders_res.calldata["verdict"]:
        return False

    # 2. Numeric field: compared with tolerance, same pattern as the documented
    #    "average product rating" example (Comparative Equivalence Principle).
    if abs(my_result["score"] - leaders_res.calldata["score"]) > 10:
        return False

    # 3. Rationale / unmet_criteria: informational only, never compared. Two
    #    reasonable evaluators can phrase the same judgment differently — this is
    #    exactly the qualitative-output case the Non-Comparative Equivalence
    #    Principle exists for, so we simply don't gate consensus on prose at all.
    return True
```

This is a hybrid of the documented Comparative principle (score, numeric, tolerance-based)
and Non-Comparative principle (rationale, qualitative, not compared) — applied field-by-field
inside one custom validator function, rather than picking one convenience wrapper for the
whole object. This is one flat leader/validator pair; it does not nest nondeterministic blocks.

## Error classification (ties to `docs/04-contract-spec.md` §Error codes)

| Leader outcome | Validator's correct response |
|---|---|
| `EXPECTED_*` (business-rule violation, e.g. called on wrong status) | Re-run the same deterministic checks; agree only if the validator independently hits the identical `EXPECTED_*` condition. |
| `EXTERNAL_*` (evidence URL returns 404/5xx, or empty body) | Attempt the same fetch. If also unreachable, agree (`True`) — a dead link is itself real information that should resolve toward `REJECT` in deterministic code after the nondet block, not toward a manufactured `full` verdict. |
| `TRANSIENT_*` (timeout) | Retry once inside the same nondet call before deciding; if still transient, treat as `EXTERNAL_*` for the purposes of this vote. |
| `LLM_ERROR_*` (malformed JSON, out-of-range field) | **Disagree.** Per GenLayer's own documented guidance, forcing a leader rotation on a malformed LLM output is the correct behavior — don't try to "fix" or reinterpret bad JSON inside the validator function. |

## What happens after consensus (deterministic code, outside the nondet block)

```python
verdict_result = gl.vm.run_nondet(leader_fn, validator_fn)
# --- everything below this line is deterministic, runs once, after consensus ---
docket = self.dockets[docket_id]
docket.verdict = VERDICT_MAP[verdict_result["verdict"]]
docket.score = verdict_result["score"]
docket.unmet_criteria = DynArray[str](verdict_result["unmet_criteria"])
payout, refund = self._split_escrow(docket)          # pure function, no side effects
if payout > 0:
    gl.chain.Account(docket.worker).emit_transfer(value=payout)
if refund > 0:
    gl.chain.Account(docket.client).emit_transfer(value=refund)
self._update_reputation(docket)                       # storage writes, deterministic
docket.status = STATUS_RESOLVED
```

`_split_escrow` is a pure, deterministic function over already-agreed values — it is
intentionally kept out of any nondet block so it needs no equivalence strategy of its own
and is trivially covered by direct unit tests.

## Prompt-injection defense

Evidence content is untrusted input by construction (it's whatever a worker's linked page
says). The prompt sent to `gl.nondet.exec_prompt` must:

- Clearly delimit SOW/criteria text from fetched evidence content (e.g. XML-style tags),
  and instruct the model explicitly that instructions appearing *inside* the evidence
  content are data, not commands.
- Never let fetched evidence content influence the `response_format` or which fields are
  requested — those are fixed in the prompt template, not derived from evidence.
- Cap evidence content length deterministically before it reaches the prompt, so a
  malicious page can't blow the context window or bury the real acceptance criteria.

See `docs/07-security-and-audit-checklist.md` §Prompt Injection for the full checklist,
which follows GenLayer's own documented security guidance on this exact risk.
