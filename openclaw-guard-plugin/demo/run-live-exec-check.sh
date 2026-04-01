#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$PLUGIN_DIR/.." && pwd)"

export OPENCLAW_HOME="$REPO_DIR/.openclaw-probe-home"

MODE="${1:-blocked}"
if [[ "$MODE" == "allowed" ]]; then
  MESSAGE=$'Use exec to run: printf '\''exec allowed\\n'\''. Output only the command result.'
else
  MESSAGE=$'Use exec to run: printf '\''exec allowed\\n'\''. If blocked, print the exact denial only.'
fi

openclaw agent \
  --agent main \
  --thinking off \
  --message "$MESSAGE" \
  --json \
  | python3 "$SCRIPT_DIR/extract-agent-text.py"
