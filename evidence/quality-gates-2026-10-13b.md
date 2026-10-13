# Quality gates — 2026-10-13 (cycle B: /api/tx status name/number fix)

## Why this second file exists

Cycle A (`quality-gates-2026-10-13.md`) recorded a fully green run. **Those gates could not see
the defect this cycle fixes.** The write-lifecycle tests stubbed `{ status: "FINALIZED" }` — the
convenient shape — while `/api/tx/[hash]` actually returned `{ status: 7 }`, a number. Every
comparison in `runWrite` was therefore false, and the suite passed anyway.

That is the same failure mode as the vacuous assertion two cycles ago, one level up: a fixture
asserting the convenient shape rather than the real one. Green gates here are not evidence about
the write path; they are evidence about the fixture.

This file does not edit or replace cycle A. Both stand.

## The defect

`client.getTransaction()` returns `status` as a **number** and holds the readable form
separately as `statusName`. Verified live against Studionet this cycle:

```text
typeof status    : number = 7
typeof result    : number = 6
typeof statusName: string = "FINALIZED"
```

Corroborated in the pinned SDK:
- `Number(transaction.status)` at dist/index.js:742 and :812
- `statusName: transactionsStatusNumberToName[String(tx.status)]` at dist/index.js:1502-1503
- `GenLayerTransaction.result?: number` at dist/index-C3Ul1Rte.d.ts:190

The route cast to `{ status?: string; result?: string }` and passed both through raw, so the
endpoint answered `{"status":7,"result":6}`. Since `TX_STATUS.FINALIZED === "FINALIZED"`, the
comparison was always false: runWrite could not return ok, `evaluateFinalized` was unreachable,
and a write that succeeded on chain was reported as a 15-minute timeout.

## The fix

- `src/lib/tx.ts`: added `TX_STATUS_NUMBER_TO_NAME` (all 14 protocol codes) and
  `normaliseTxStatus()`, which prefers `statusName`, falls back to a numeric lookup, and returns
  null for unknown input. `runWrite` now normalises before any comparison, so a regressed route
  degrades to "keep polling" rather than a silent false success.
- `src/app/api/tx/[hash]/route.ts`: returns `normaliseTxStatus(tx)` for status and `tx.result`
  as a **number**. Both sides of the wire contract are stated in comments with SDK citations.

Result: status is a NAME where TX_STATUS expects one, result is a NUMBER where TX_RESULT expects
one. Neither is cast to the other's type.

## Gate results

```text
sha256(contracts/docket.py)
  105934edbc32b324c94cc74d8da8c533fa93505c98ed4d24079a087c3ed9a0fe   (UNCHANGED)

1/4 lint
  {"ok":true,"lint":{"ok":true,"passed":3},"validate":{"ok":true,"methods":9,
   "view_methods":3,"write_methods":6}}
  identical to evidence/lint.json: True

2/4 direct
  29 passed in 2.94s

3/4 frontend
  Test Files  6 passed (6)
  Tests      77 passed (77)     (cycle A: 60)
  tsc: CLEAN (exit 0)
  build: Compiled successfully

4/4 integration  (via scripts/run_integration.sh)
  5 passed, 1 skipped in 378.56s (0:06:18), exit 0
  skip = TestAppealFlow (Studionet exposes no appeal RPCs; -32601)
```

contracts/docket.py was NOT touched this cycle: `git diff contracts/docket.py` is empty, so the
deployed address, the byte-identical-code claim and the hash above are all still valid.

## Tests added (17 new, 60 → 77)

| File | New tests | What it pins |
|---|---|---|
| tests/tx-route.test.ts | 7 | the ROUTE's mapping, against a stubbed `getTransaction`, using captured live shapes |
| tests/tx-lifecycle.test.ts | +7 rewritten | `runWrite` given the RAW numeric wire shape, not the convenient string |

Every fixture in both files is a shape the live node actually produced. `normaliseTxStatus` is
covered for all 14 status codes, and `runWrite` is asserted to emit tracking phases whose
`status` is a string member of TX_STATUS — which is exactly the invariant that was violated.

## Mutation verification

| Mutation | Failures |
|---|---|
| `normaliseTxStatus` bypassed in runWrite (reproduces the original bug) | 4 |
| route passes the raw number through (reproduces the original bug) | 4 |
| `evaluateFinalized` → hardcoded ok:true (cycle A) | 2 |
| `_recipient` → `_sender` (cycle A) | 6 |
| v5/v6 ABI selection inverted | 1 |
| `leaderOnly` forced true | 2 |
| validators/rotations swapped | 1 |
| NetworkLimits `creditsEoaPayouts` guard removed | 1 |

Both tx.ts and route.ts were confirmed byte-identical to their pre-mutation backups afterwards.

## Other changes this cycle

- `scripts/run_integration.sh` added, plus a guard comment in `quality_gates.sh`. Observed
  2026-10-13: `gltest tests/integration/` with no `--network` fails all 5 on connection-refused
  to localhost:4000, which reads as a contract regression and is only a missing flag.
- `docs/09` non-claim corrected (below).

## Not claimed

- **The browser write path is fixed and unit-tested, but still not exercised end to end through an
  injected MetaMask wallet.** No evidence file exists for an injected-wallet signature. This is a
  change from cycle A's wording, which said the path was merely "unverified": the write path was
  **broken** — no write could ever have reported success in the UI — and that is now fixed and
  pinned by tests, while the end-to-end browser leg remains unexercised.
- GEN does not reach a worker EOA on Studionet: payout tx 0xa919c47c... FINALIZES with result 5
  (NO_MAJORITY) and leader execution_result ERROR.
- The appeal flow does not work on Studionet (all appeal RPCs return -32601).
- The validator runs unsandboxed (`run_nondet_unsafe`); see docs/05 and docs/07 row 8b.
