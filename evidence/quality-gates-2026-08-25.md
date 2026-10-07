# Quality gates — through 2026-08-27

Source under test: `contracts/docket.py`

- SHA-256: `105934edbc32b324c94cc74d8da8c533fa93505c98ed4d24079a087c3ed9a0fe`
- Lint: PASS — `ok: true`, 9 methods; see
  `lint-localnet-rerun-2026-08-27T005246Z.json`.
- Direct tests: PASS — 29 passed; see
  `direct-tests-localnet-rerun-2026-08-27T005246Z.txt`.
- Studionet integration: BLOCKED — repeated hosted endpoint checks failed at TLS/DNS before
  reliable consensus/deployment verification; see `studionet-blocker.txt`.
- Localnet integration: PARTIAL/BLOCKED — 4 passed and 2 failed. Fast-path settlement,
  unreachable-evidence rejection, expiry, balance assertions, reads, and deployed schema pass.
  Real-evidence adjudication and appeal are blocked because the configured OpenAI credential
  returns HTTP 401; see `localnet-integration-2026-08-27T010044Z.txt`,
  `localnet-glsim-2026-08-27T010044Z.txt`, and `localnet-blocker.txt`.
- Code schema: PASS — live `gen_getContractSchemaForCode` result exactly matches
  `studionet-schema.json`; this does not substitute for `genlayer schema <deployed-address>`.

Four Localnet cases are green. The six-test integration gate is not green, and no Localnet
address or transaction is claimed as a public Studionet deployment, explorer link, or
submission artifact.
