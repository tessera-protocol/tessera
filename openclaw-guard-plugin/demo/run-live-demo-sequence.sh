#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

printf 'Tessera Guard live in OpenClaw\n\n'

printf '# blocked\n'
python3 "$SCRIPT_DIR/set-credential-state.py" none >/dev/null
"$SCRIPT_DIR/run-live-exec-check.sh" blocked
sleep 2
printf '\n'

printf '# allowed\n'
python3 "$SCRIPT_DIR/set-credential-state.py" valid >/dev/null
"$SCRIPT_DIR/run-live-exec-check.sh" allowed
sleep 2
printf '\n'

printf '# revoked\n'
python3 "$SCRIPT_DIR/set-credential-state.py" revoked >/dev/null
"$SCRIPT_DIR/run-live-exec-check.sh" blocked
sleep 3
