# Tessera Guard Local OpenClaw Plugin

This is the smallest real Tessera Guard runtime integration for OpenClaw.

It currently supports three action classes:

- live `exec` / Tessera `exec.shell`
- mutation tool guarding / Tessera `code.write` (for example `apply_patch`)
- initial `message_sending` / Tessera `message.send`

## Local credential store

Credentials are read from:

- `./local-credentials.json` for live local enforcement
- `./local-credentials.example.json` as a sample only

Shape:

```json
{
  "agents": {
    "main": {
      "credentialId": "cred-main-shell-1",
      "agentId": "main",
      "issuer": "local-demo",
      "issuedAt": 1775049000,
      "expiresAt": 1775053200,
      "revoked": false,
      "scope": {
        "actions": ["exec.shell", "message.send", "code.write"]
      }
    }
  }
}
```

`local-credentials.json` is intentionally ignored so machine-local credential state does not get committed. The example file is for reference only and is not consulted by the live plugin at runtime.

## Install locally

Use a repo-local OpenClaw home so this does not touch your main runtime profile:

```bash
cd /path/to/tessera
OPENCLAW_HOME="$PWD/.openclaw-probe-home" \
script -q /dev/null openclaw plugins install --link "$PWD/openclaw-guard-plugin"
```

## Run the exec enforcement tests

```bash
cd /path/to/tessera/openclaw-guard-plugin
OPENCLAW_HOME="$(cd .. && pwd)/.openclaw-probe-home" node ./test-shell-exec-enforcement.js
```

Expected sequence:

1. no credential -> blocked
2. valid `exec.shell` credential -> allowed
3. revoked credential -> blocked

## Run the message hook test

```bash
cd /path/to/tessera/openclaw-guard-plugin
node ./test-message-hook.js
```

Expected sequence:

1. no credential -> cancelled
2. valid `message.send` credential -> allowed
3. revoked credential -> cancelled

## Interception point

The real execution boundary is OpenClaw's plugin hook:

- `before_tool_call`

In the installed live runtime, this plugin maps:

- OpenClaw tool `exec` (and the hook-runner alias `shell.exec`)
- to Tessera action `exec.shell`
- OpenClaw mutation tools such as `apply_patch`
- to Tessera action `code.write`

## Live local session

Use the repo-scoped OpenClaw home, start the gateway, then run a real agent turn for `exec`:

```bash
cd /path/to/tessera
OPENCLAW_HOME="$PWD/.openclaw-probe-home" \
openclaw gateway run --allow-unconfigured --verbose
```

```bash
OPENCLAW_HOME=/path/to/tessera/.openclaw-probe-home \
openclaw agent --agent main --message "Run pwd using the exec tool now. If a tool policy blocks execution, reply with the exact denial reason and nothing else." --json
```

The live path now proves:

1. no credential for `main` -> blocked
2. valid `exec.shell` credential for `main` -> allowed
3. revoked credential for `main` -> blocked

## Message path status

The plugin now enforces `message.send` at the real `message_sending` hook boundary, and that remains an important target action class for Tessera Guard.

However, `message.send` is not yet live-proven end to end under one clean Tessera-enforced and auditable outbound path in the current runtime wiring.

In practice, the remaining blocker is not just channel availability. The current OpenClaw outbound send paths do not yet yield one consistent path that both:

1. exercises the loaded Tessera guard hook in the active runtime
2. produces a successful, auditable outbound delivery result

So the current claim should stay narrow:

- `message.send` is real at the hook boundary
- deny/allow behavior is regression-tested at that boundary
- full live outbound proof still depends on clearer runtime/channel path coverage

## Hardening regression tests

```bash
cd /Users/guglielmoreggio/code/tessera/openclaw-guard-plugin
npm run test:hardening
```

This covers:

1. `before_tool_call` deny/allow/deny for `apply_patch` based on `code.write` scope
2. `message_sending` deny/allow behavior for `message.send`
3. hash-chained local decision log continuity

## What is still stubbed

- local JSON credentials only
- no issuer service
- no VC/ZK verification
- no single clean live-proven outbound `message.send` path yet in the current runtime wiring
- no persistent revocation registry beyond the `revoked` field in the local credential file
