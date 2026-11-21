#!/usr/bin/env bash
# Build the real app's web bundle, screenshot every screen in headless Chromium (Lynx's web layer is Chromium-only,
# so the board shows PNGs and works in Zen/Firefox/Safari), restart the preview server and open the board.
# Usage: web/scripts/show.sh [--no-build]     (also: `pnpm show`, or /show-ui in Claude Code)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-5173}"
if [ "${1:-}" != "--no-build" ]; then
  echo "building web bundle..."
  npx rspeedy build >/tmp/salin-show-build.log 2>&1 || { tail -20 /tmp/salin-show-build.log; echo "build failed"; exit 1; }
fi
echo "screenshotting screens..."
node preview/board-shots.mjs 2>&1 | grep -v -i deprecat | grep -v trace-deprecation || true
pkill -f "preview/server.mjs" 2>/dev/null || true
sleep 0.5
PORT="$PORT" nohup node preview/server.mjs >/tmp/salin-show-server.log 2>&1 &
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/app"; then break; fi
  sleep 0.2
done
URL="http://127.0.0.1:$PORT/app"
echo "UI board: $URL"
open "$URL" 2>/dev/null || true
