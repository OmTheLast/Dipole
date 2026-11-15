#!/bin/sh
# Requires Node with Playwright and a Chromium browser, plus Python 3 with Pillow.
set -eu
cd "$(dirname "$0")/.."
work=$(mktemp -d)
server=
trap 'if [ -n "$server" ]; then kill "$server" 2>/dev/null || true; fi; rm -rf "$work"' EXIT
python3 -u -m http.server 0 --bind 127.0.0.1 --directory docs > "$work/server.log" 2>&1 &
server=$!
for attempt in $(seq 1 100); do
  port=$(sed -n 's/.* port \([0-9]*\) .*/\1/p' "$work/server.log" | head -1)
  [ -n "$port" ] && break
  sleep 0.1
done
test -n "$port"
node guide/capture.cjs "http://127.0.0.1:$port/" "$work"
python3 guide/build_index.py "$work"
