# Quality gates — 2026-10-13

> **SUPERSEDED IN PART — read `quality-gates-2026-10-13b.md` first.**
> The green run recorded here could **not** see a defect that was live at the time: the write
> lifecycle was non-functional because `/api/tx` returned a numeric `status` while `tx.ts`
> compared against name strings. These tests passed because their fixture fed the convenient string
> shape. This file is left unmodified as the historical record; the later file is the accurate one.

Full gate chain in CLAUDE.md order, run end to end. Contract source was NOT modified in this
cycle, so `sha256(contracts/docket.py)` is unchanged and the deployed address remains valid.

## 1. Contract hash (unchanged)

```text
105934edbc32b324c94cc74d8da8c533fa93505c98ed4d24079a087c3ed9a0fe  contracts/docket.py
```

Matches the value recorded in AUDIT_HANDOFF.md and in evidence/lint.json.

## 2. Lint — GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/docket.py --json

```json
{
    "ok": true,
    "lint": {
        "ok": true,
        "passed": 3
    },
    "validate": {
        "ok": true,
        "contract": "DocketContract",
        "methods": 9,
        "view_methods": 3,
        "write_methods": 6,
        "ctor_params": 0,
        "warnings": [
            {
                "code": "I200",
                "msg": "py-genlayer: a newer runner is available (1zr6nqk597d97kg0dyxg0shhrykx5v02zjgnyrajapy4wlqvfvwh). See https://github.com/genlayerlabs/genvm/releases for changes."
            }
        ]
    }
}
```

Verified byte-identical to `evidence/lint.json` (compared as normalized JSON: `lint` and
`validate` blocks both equal). ok:true, 3 lint rules passed, 9 methods / 3 view / 6 write.

## 3. Direct tests — pytest tests/direct/ -v

```text
============================= 29 passed in 3.97s ==============================
```

29/29 against real GenVM (genlayer-test 0.29.2, `gltest_direct` plugin).

## 4. Integration — gltest --network studionet tests/integration/ -v

```text
=================== 5 passed, 1 skipped in 378.79s (0:06:18) ===================
```

Same result as 2026-10-07. The skip is `TestAppealFlow` — Studionet exposes no appeal RPCs
(gen_appealTransaction / gen_getAppealCharge / gen_canAppeal all return -32601), so the appeal
case cannot run there. It is a network capability limit, not a passing test.

NOTE: `gltest tests/integration/` without `--network studionet` defaults to localhost:4000 and
fails all 5 with connection-refused. The flag is required; see scripts/quality_gates.sh:23.

## 5. Frontend — vitest + tsc + build

```text
 Test Files  5 passed (5)
      Tests  60 passed (60)
tsc: CLEAN (exit 0)
✓ Compiled successfully
```

60 vitest tests across 5 files (was 29 in 2 files before this cycle):

| File | Tests | What it pins |
|---|---|---|
| contract-parity.test.ts | 12 | frontend status/verdict enums vs contracts/docket.py |
| responsive.test.ts | 29 | no fixed widths / unwrapped multi-column grids |
| write-targeting.test.ts | 14 | addTransaction payload names the Docket contract; ABI variant, leaderOnly, consensus params |
| tx-lifecycle.test.ts | 10 | FINALIZED-but-failed is not success (the P0-2 regression) |
| network-flags.test.tsx | 7 | creditsEoaPayouts / requiresEscrowFunds / appealSupport reach the UI |

## Mutation verification (the tests can fail)

Each mutant below was applied to source, the full suite run, and source restored with `diff`:

| Mutation | Result |
|---|---|
| `_recipient` → `_sender` in encodeWriteTransaction | 6 fail |
| EVM `to` → Docket instead of consensus contract | 6 fail |
| `evaluateFinalized` → hardcoded ok:true | 2 fail |
| v5/v6 ABI selection inverted (`>= 6` → `>= 5`) | 1 fail |
| `leaderOnly` forced true | 2 fail |
| validators/rotations swapped | 1 fail |
| NetworkLimits `creditsEoaPayouts` guard removed | 1 fail |

All restored: `diff` against pre-mutation backup reports identical.

## Not claimed

- **The browser-wallet write path is not verified end to end.** No evidence file exists for an
  injected-wallet signature. Writes verified here went through genlayer-js's local-account signer
  and unit tests over the encoder.
- GEN does not reach a worker EOA on Studionet. The payout child tx
  0xa919c47c6872ed1c778cc1752e1c3cd2078d348bb0702cb0a05c6efc50fdde1d FINALIZES with result 5
  (NO_MAJORITY) and leader execution_result ERROR.
- The appeal flow does not work on Studionet.
- The validator runs unsandboxed (`run_nondet_unsafe`); see docs/05 and docs/07 row 8b.
