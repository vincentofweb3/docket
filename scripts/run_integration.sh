#!/usr/bin/env bash
# Runs the Studionet integration suite with the correct network flag.
#
# Exists because `gltest tests/integration/` with no --network defaults to localhost:4000 and
# fails all 5 tests with connection-refused, which is easy to misread as a contract failure.
set -euo pipefail
export GENVM_VERSION="${GENVM_VERSION:-v0.3.0-rc7}"
cd "$(dirname "$0")/.."
gltest --network studionet tests/integration/ -v -s
