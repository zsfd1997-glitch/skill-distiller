#!/usr/bin/env bash
# Stop hook: incrementally harvest candidates when a session ends.
# Deliberately tiny — it only updates candidates/seen, never generates skills and
# never blocks the session. Runs detached with a hard 5s timeout as a safety net.
timeout 5 node "${CLAUDE_PLUGIN_ROOT}/scripts/scan_sessions.mjs" --incremental >/dev/null 2>&1 &
exit 0
