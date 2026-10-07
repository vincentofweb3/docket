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
gltest --network studionet tests/integration/ -v -s

echo "All quality gates passed."
