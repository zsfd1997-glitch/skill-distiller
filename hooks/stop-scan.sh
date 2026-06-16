#!/usr/bin/env bash
# Stop hook: incrementally harvest candidates when a session ends.
# Deliberately tiny — it only updates candidates/seen, never generates skills and
# never blocks the session. Runs detached with a hard 5s timeout as a safety net.
node "${CLAUDE_PLUGIN_ROOT}/scripts/scan_sessions.mjs" --incremental >/dev/null 2>&1 &
NODE_PID=$!
# Portable watchdog (macOS has no `timeout`): kill the scan if it overruns 10s.
( sleep 10; kill "$NODE_PID" 2>/dev/null ) >/dev/null 2>&1 &
exit 0
