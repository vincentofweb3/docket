# Docket Audit Handoff

Prepared: 2026-09-03 · Updated: 2026-10-07

This file is the current handoff for any agent continuing Docket. It consolidates the
authoritative implementation status and the raw evidence already checked into `evidence/`.
As of 2026-10-07 Docket has a verified Studionet deployment and a green integration gate, but
still lacks a public repository and a frontend demo, and does **not** demonstrate payout to a
recipient EOA on Studionet.

## Current Status

Updated 2026-10-07. Supersedes the 2026-09-03 status table. The Studionet DNS/TLS blocker is
**resolved**; the contract is deployed and the integration suite is green.

| Area | Current result | Authoritative evidence |
|---|---|---|
| Contract API/lint | PASS — no `# VERIFY:` markers; `ok: true`, 9 methods (3 view, 6 write) | [`evidence/lint-studionet-2026-10-07.json`](evidence/lint-studionet-2026-10-07.json) |
| Direct tests | PASS — 29 passed | [`evidence/direct-tests-studionet-2026-10-07.txt`](evidence/direct-tests-studionet-2026-10-07.txt) |
| Studionet deployment | PASS — `0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B`, 3 validators agreed, leader `SUCCESS` | [`evidence/studionet-deployment-2026-10-07.txt`](evidence/studionet-deployment-2026-10-07.txt) |
| Deployed code integrity | PASS — `gen_getContractCode` byte-identical to `contracts/docket.py` | [`evidence/studionet-address-evidence-2026-10-07.json`](evidence/studionet-address-evidence-2026-10-07.json) |
| Address-derived schema | PASS — 9 methods, matches `docs/04` | same as above |
| Studionet integration | PASS — 5 passed, 1 skipped, exit 0 | [`evidence/integration-studionet-2026-10-07.txt`](evidence/integration-studionet-2026-10-07.txt) |
| Public lifecycle evidence | PASS — fast path settled `FULL`/100; disputed docket settled `REJECT`/10 by AI consensus with 3 unmet criteria | same as deployment file |
| Payout to recipient EOA | **NOT DEMONSTRATED on Studionet** — escrow drains correctly but the worker EOA is never credited | [`evidence/studionet-fund-trace-2026-10-07.json`](evidence/studionet-fund-trace-2026-10-07.json) |
| Appeal flow | SKIPPED on Studionet — appeal RPCs do not exist on that network | same as integration file |
| Security checklist | Rows 1–27 evidenced; payout/appeal rows need re-checking against the Studionet findings | [`docs/07-security-and-audit-checklist.md`](docs/07-security-and-audit-checklist.md) |
| Submission readiness | Deployed address + explorer links now available; public repository and frontend demo still missing | [`docs/09-submission-and-review-readiness.md`](docs/09-submission-and-review-readiness.md) |
| Frontend/Bradbury | Frontend not started (prerequisite now met); no Bradbury deployment | [`frontend/README.md`](frontend/README.md) |

Consolidated gate status: [`evidence/quality-gates-2026-10-07.md`](evidence/quality-gates-2026-10-07.md).

### Critical non-claims

1. **GEN does not reach a recipient wallet on Studionet.** `accept_deliverable` emits an
   external message; the resulting child transaction
   `0xa919c47c6872ed1c778cc1752e1c3cd2078d348bb0702cb0a05c6efc50fdde1d` reaches FINALIZED
   with `execution_result ERROR` and an empty vote map, so the recipient balance never changes.
   Per the docs, Studio has no EVM layer or ghost contracts. The contract's own
   `_assert_escrow_conserved` invariant is intact and the deployed contract settles to `0x0`.
   Never claim real payouts from Studionet evidence; re-verify on Bradbury.
2. The worker-credit assertion is gated behind `_eoa_credit_supported` in the integration
   suite and prints a NOTICE on every run, so a pass is never mistaken for a payout.
3. Appeals cannot be exercised on Studionet: `gen_appealTransaction`, `gen_getAppealCharge`
   and `gen_canAppeal` all return -32601.
4. The earlier transaction hash `0x1b866ff5…` in `evidence/studionet-blocker.txt` remains
   debugging evidence only. The real deployment is the address above.

The contract source used for the recorded gate evidence has SHA-256:

```text
105934edbc32b324c94cc74d8da8c533fa93505c98ed4d24079a087c3ed9a0fe
```

The workspace has no usable Git history (`.git` is an empty directory), so source hashes and
dated raw logs are the available audit identity. Recompute the hash before relying on older
evidence after any source change.

## Work Completed

- The initial reviewer pass read the required repository files in order and produced
  [`REVIEW_REPORT.md`](REVIEW_REPORT.md).
- The contract was migrated to the current GenLayer v0.3-compatible API while retaining a
  legacy fallback for the installed test harness: imports/storage decorators, contract base,
  transaction time, zero address, transfers, nondeterministic runner, and user-error payloads.
- Deterministic safety behavior was added: fast-path status recording, escrow conservation
  assertions, state-before-transfer ordering, bounded adjudication output, response status/body
  checks, one retry for transient evidence fetches, and deterministic rejection for unreachable
  evidence.
- The direct test skeleton was wired to the verified harness and expanded to 29 passing cases,
  including lifecycle permissions, adjudication parsing/error handling, expiry, escrow splits,
  and storage typing.
- The integration suite was wired to GLSim/gltest. Four deterministic/local cases pass; two
  cases require a working external LLM provider and remain blocked by credentials.
- `docs/07-security-and-audit-checklist.md` and
  `docs/09-submission-and-review-readiness.md` were updated with evidence and explicit blockers.
- All 13 frontend/design screens named by the integration plan exist in `design/`; no running
  frontend has been scaffolded.
- Live GenLayer API, prompt-injection, dependency-pin, portal, and builder-resource checks were
  captured in the reviewer report and supporting evidence files.

## Evidence Map

Use the small summary files first, then inspect the raw run output they reference:

- [`evidence/quality-gates-2026-08-25.md`](evidence/quality-gates-2026-08-25.md) — consolidated gate status through the 2026-08-27 runs.
- [`evidence/lint.json`](evidence/lint.json) and the timestamped lint JSON — raw lint results.
- [`evidence/direct-tests.txt`](evidence/direct-tests.txt) and the timestamped direct log — raw 29-test results.
- [`evidence/localnet-blocker.txt`](evidence/localnet-blocker.txt) — current Localnet diagnosis and next command.
- `evidence/localnet-integration-*.txt` — Localnet test runs; the `2026-08-27T010044Z` run is the current 4/6 summary.
- `evidence/localnet-glsim-*.txt` — GLSim server output, including the provider authentication failure.
- [`evidence/studionet-blocker.txt`](evidence/studionet-blocker.txt) — all Studionet non-claims and failed availability checks.
- [`evidence/security-guidance.txt`](evidence/security-guidance.txt), [`evidence/framing-scan.txt`](evidence/framing-scan.txt), and [`evidence/dependency-pin.txt`](evidence/dependency-pin.txt) — security, terminology, and runner-pin evidence.
- [`REVIEW_REPORT.md`](REVIEW_REPORT.md) — historical API/spec review dated 2026-08-24. Its initial “needs change” findings describe the pre-migration scaffold; use this handoff and current source/docs for present status.

The complete raw artifact set is in [`evidence/`](evidence/). Files with older timestamps are
diagnostic history, not additional green gate results. In particular, do not infer success from
receipt envelopes whose consensus result could not be read.

## Known Blockers and Non-Claims

1. **Localnet provider credential:** GLSim reached `https://api.openai.com/v1/chat/completions`
   and received HTTP 401 for the real-evidence dispute and appeal cases. The contract correctly
   surfaced `LLM_ERROR_MALFORMED_VERDICT`; this is not evidence that those contract cases pass.
2. **Studionet network:** `studio.genlayer.com` has failed repeated DNS/TLS checks. No usable
   Studionet contract address, deployed-address schema, explorer link, or public lifecycle
   transaction has been verified.
3. The earlier transaction hash retained in `evidence/studionet-blocker.txt` is debugging
   evidence only. It must not be presented as a successful Docket deployment.
4. Localnet/GLSim is simulator evidence, not public GenLayer submission evidence.
5. No OpenAI credential is stored in this repository. Never write a real key to a file or commit
   it; provide it only in the shell that starts GLSim.

## Resume Procedure

The toolchain is no longer at `/tmp/docket-site` — that directory is gone. Rebuild once:

```bash
curl -sS -o /tmp/get-pip.py https://bootstrap.pypa.io/get-pip.py
python3 /tmp/get-pip.py --user --break-system-packages
python3 -m pip install --user --break-system-packages genvm-linter "genlayer-test[sim]"
export PATH="$HOME/.local/bin:$PATH"
```

Quality gates, in the order CLAUDE.md requires:

```bash
GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/docket.py --json
pytest tests/direct/ -v
gltest --network studionet tests/integration/ -v -s
```

`GENVM_VERSION=v0.3.0-rc7` is **required**. Without it the linter picks a newer bundle whose
tar layout breaks SDK loading (`E101 filename 'runners/py-genlayer/...' not found`). This
environment also has no `sudo`, so system-level `apt install` is unavailable.

Studionet is the primary integration target now — no LLM key is needed because its validators
supply their own providers. Localnet/GLSim is only useful for debugging, and Docker is disabled
in WSL so GLSim must run standalone.

Two environment workarounds that are required, not optional:

- **WSL DNS breaks node/undici** for `studio.genlayer.com` (it receives unusable Cloudflare
  anycast addresses and times out where curl succeeds):
  ```js
  net.setDefaultAutoSelectFamily(false);
  dns.setDefaultResultOrder("ipv4first");
  ```
- **The `genlayer` CLI prompts for a keystore password interactively**, so it cannot be driven
  from a non-interactive agent. Use `genlayer-js` directly and derive the account in-process
  from the encrypted keystore with `ethers.Wallet.fromEncryptedJson` (it is async in ethers v6).
  `genlayer-js` 1.1.8 does not export `CalldataAddress` from the package root; load it from
  `dist/chunk-*.js` or wrap addresses as `{ bytes: Uint8Array(20) }`, or every call taking an
  `Address` reverts in `TreeMap`.

Do not claim submission evidence until public links resolve outside the operator's account.

## Next-Agent Order

1. Recompute the contract SHA-256 and read this file, `CLAUDE.md`, `docs/07`, and `docs/09`.
2. Rebuild the toolchain per "Resume Procedure" and confirm
   `GENVM_VERSION=v0.3.0-rc7 genvm-lint check contracts/docket.py --json` reports `ok: true`.
3. Initialize the public GitHub repository — this is the single hardest submission blocker, since
   the Builder "Intelligent Contracts" contribution type requires a `github-repo` URL and file
   uploads are disabled. Commit source, docs, and the 2026-10-07 evidence files.
4. Scaffold the frontend from `design/` against the deployed address
   `0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B`. The deployment/schema prerequisite is now met.
   Read calls must wrap addresses (see the `CalldataAddress` note above).
5. Deploy to Bradbury and re-verify the two things Studionet cannot demonstrate: that a payout
   actually credits the recipient EOA, and that the appeal flow works. Both are required before
   any claim about real money moving or about appeals.
6. Ask the GenLayer team about the Studionet payout behaviour recorded in
   `evidence/integration-studionet-2026-10-07.txt` — whether it is intended.
7. Re-run the security/submission checklists against the final source and the live portal process
   immediately before submitting.
8. Do not submit Points evidence until the repository, explorer links, test log, and frontend
   demo URL are all independently reachable from outside the operator's account.

## Audit Boundaries

- This handoff records verification; it is not authorization to deploy or to alter production
  logic.
- Any new agent must preserve existing evidence and distinguish current runs from historical
  diagnostics.
- If source, tests, or docs change, append a new dated evidence record and update this handoff's
  status rather than silently reusing an old hash or “PASS” claim.
