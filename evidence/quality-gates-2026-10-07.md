# Quality gates — through 2026-10-07

Supersedes `quality-gates-2026-08-25.md`. Source under test: `contracts/docket.py`,
SHA-256 `105934edbc32b324c94cc74d8da8c533fa93505c98ed4d24079a087c3ed9a0fe` — unchanged from
the 2026-08-27 runs and byte-identical to the deployed Studionet code.

## Gate status

| Gate | Result | Evidence |
|---|---|---|
| `genvm-lint check` | PASS — `ok: true`, 9 methods (3 view, 6 write) | `lint-studionet-2026-10-07.json` |
| Direct tests | PASS — 29 passed | `direct-tests-studionet-2026-10-07.txt` |
| Studionet deployment | PASS — `0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B` | `studionet-deployment-2026-10-07.txt` |
| Address-derived schema | PASS — 9 methods, matches `docs/04` | `studionet-address-evidence-2026-10-07.json` |
| Studionet integration | PASS — 5 passed, 1 skipped, exit 0 | `integration-studionet-2026-10-07.txt` |

`genvm-lint` requires `GENVM_VERSION=v0.3.0-rc7`. Without it the resolver selects a newer
bundle whose tar layout breaks SDK loading with `E101 filename 'runners/py-genlayer/...' not found`.

## What changed since 2026-08-27

The Studionet DNS/TLS blocker is **resolved**. `studio.genlayer.com` serves JSON-RPC
(`eth_chainId` → `0xf22f` / 61999), the contract is deployed at a verified address with
explorer links, and two complete public lifecycles are recorded — including a disputed docket
settled by real AI-validator consensus (verdict `reject`, score 10, three specific unmet criteria).

The two Localnet cases blocked on an OpenAI HTTP 401 now **pass on Studionet**, because
Studionet validators supply their own LLM providers. No operator key is required.

## Open issues — do not paper over

1. **GEN does not reach a recipient wallet on Studionet.** Escrow leaves the contract but the
   worker EOA is never credited; the payout child transaction finalizes with
   `execution_result ERROR` and empty votes. Attributed to Studio having no EVM layer or
   ghost contracts. Docket's contract-side accounting and `_assert_escrow_conserved` are
   intact. **Do not claim real payouts on Studionet.** Re-verify on Bradbury. Details and raw
   per-step balances in `integration-studionet-2026-10-07.txt` and
   `studionet-fund-trace-2026-10-07.json`.
2. **Appeals cannot be tested on Studionet.** `gen_appealTransaction`, `gen_getAppealCharge`
   and `gen_canAppeal` all return -32601; the `genlayer-js` studionet chain definition sets the
   appeal/fee/rounds contracts to null. The test skips with an explicit reason.
3. **`genlayer-js` 1.1.8 does not export `CalldataAddress`.** An external call passing an
   `Address`-typed parameter as a plain hex string is encoded as `TYPE_BYTES`, and GenVM's
   `TreeMap` reverts with `assert isinstance(r, Address)`. Contract code is correct; callers
   must wrap addresses. Internal contract calls are unaffected, which is why the 29 direct
   tests do not catch it. A working example is in `studionet-address-evidence-2026-10-07.json`.
4. **WSL networking:** node/undici receives unusable Cloudflare anycast addresses for
   `studio.genlayer.com` and times out where curl succeeds. `net.setDefaultAutoSelectFamily(false)`
   plus `dns.setDefaultResultOrder("ipv4first")` fixes it.
5. **Docker in WSL is disabled**, so GLSim must run standalone.

## Not claimed

No public GitHub repository, no frontend demo, no Bradbury deployment. The Builder submission
still requires a repository URL and a frontend demo link.