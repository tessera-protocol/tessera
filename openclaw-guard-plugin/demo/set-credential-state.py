#!/usr/bin/env python3
import json
import sys
import time
from pathlib import Path


PLUGIN_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_PATH = PLUGIN_DIR / "local-credentials.json"


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"none", "valid", "revoked"}:
        print("usage: set-credential-state.py [none|valid|revoked]", file=sys.stderr)
        return 1

    state = sys.argv[1]
    if state == "none":
        payload = {"agents": {}}
    else:
        now = int(time.time())
        payload = {
            "agents": {
                "main": {
                    "credentialId": "cred-main-shell-1",
                    "agentId": "main",
                    "issuer": "local-demo",
                    "issuedAt": now,
                    "expiresAt": now + 3600,
                    "revoked": state == "revoked",
                    "scope": {
                        "actions": ["exec.shell"]
                    }
                }
            }
        }

    CREDENTIALS_PATH.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    print(f"credential state: {state}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
