#!/bin/bash
# MCP stdio wrapper for webmcp-bridge.mjs: auto-detect a running debug Chrome CDP endpoint.
# Checks, in order: $NEWSPAPER_CDP env, DevToolsActivePort files of known profiles, common ports.
set -u

check_cdp() { curl -s --max-time 1 "http://127.0.0.1:$1/json/version" | grep -q webSocketDebuggerUrl; }

# Priority: explicit env > user-visible debug Chrome ports > profile files (headless harness LAST)
candidates=()
[ -n "${NEWSPAPER_CDP:-}" ] && candidates+=("$NEWSPAPER_CDP")
candidates+=(9223 9222)
for prof in \
  "$HOME/.hermes/cache/scratch/chrome-debug-profile/DevToolsActivePort" \
  "$HOME/.hermes/browser-profile/chrome/DevToolsActivePort"; do
  if [ -f "$prof" ]; then p=$(head -1 "$prof"); candidates+=("$p"); fi
done

for p in "${candidates[@]}"; do
  if [ -n "$p" ] && check_cdp "$p"; then
    echo "[mcp-serve] using CDP http://127.0.0.1:$p" >&2
    REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$REPO_DIR/bridge/webmcp-bridge.mjs" --cdp "http://127.0.0.1:$p" --url "http://localhost:3000"
  fi
done

echo "No debug Chrome CDP endpoint found. Start one:" >&2
echo '  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9223 --user-data-dir=~/.hermes/cache/scratch/chrome-debug-profile --no-first-run http://localhost:3000' >&2
exit 1
