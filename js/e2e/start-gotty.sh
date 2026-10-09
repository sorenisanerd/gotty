#!/usr/bin/env bash
#
# Build gotty and start it for the Playwright E2E tests, with a writable bash
# shell on a fixed port. The tests drive the terminal over the real WebSocket
# and assert on filesystem side effects, so no PTY/text-scraping tricks needed.
set -euo pipefail

# Make sure a locally-installed Go is found (CI's setup-go already puts it on PATH).
export PATH="$PATH:/usr/local/go/bin"

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${HERE}/../.." && pwd)"
BIN="${REPO_ROOT}/builds/e2e/gotty"

mkdir -p "$(dirname "${BIN}")"
( cd "${REPO_ROOT}" && go build -o "${BIN}" . )

exec "${BIN}" \
  --address 127.0.0.1 \
  --port 8099 \
  --permit-write \
  --confirm-close=false \
  --quiet \
  bash --noprofile --norc
