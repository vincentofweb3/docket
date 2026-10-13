#!/usr/bin/env bash
# Runs Docket's quality gates in the exact order specified in CLAUDE.md and
# docs/07-security-and-audit-checklist.md. Stops on first failure -- do not
# reorder these, and do not add a flag to skip a gate.
#
# GENVM_VERSION must be pinned: without it genvm-lint resolves a newer GenVM
# bundle whose tar layout breaks SDK loading (E101, "runners/py-genlayer/...
# not found"). See evidence/quality-gates-2026-10-07.md.
export GENVM_VERSION="${GENVM_VERSION:-v0.3.0-rc7}"

set -euo pipefail

echo "== 1/3: genvm-lint =="
genvm-lint check contracts/docket.py --json

echo "== 2/3: direct tests =="
pytest tests/direct/ -v

# Studionet, not Localnet: its validators supply their own LLM providers, so
# live-evidence adjudication is exercised without an operator API key. Requires
# no GLSim and no Docker.
echo "== 3/3: integration tests (requires network access to the GenLayer RPC) =="
# --network studionet is REQUIRED, not a preference. Without it gltest defaults to
# localhost:4000 and every test fails with a connection-refused DeploymentError, which reads
# like a contract defect but is purely a missing flag. Observed 2026-10-13: 5 failed,
# "Max retries exceeded with url: /api (Connection refused)".
gltest --network studionet tests/integration/ -v -s

echo "All quality gates passed."

# --- Manual-invocation guard -------------------------------------------------
# If someone runs `gltest tests/integration/` directly without --network, gltest targets
# localhost:4000 and all 5 tests fail with connection-refused. That looks like a contract
# regression and is not one. Use this wrapper, which always passes the flag:
#
#   bash scripts/run_integration.sh
#
# Verified correct invocation (2026-10-13): 5 passed, 1 skipped in 378.79s (exit 0).
