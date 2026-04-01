# Tessera Guard Local OpenClaw Plugin

This is the smallest real Tessera Guard runtime integration for OpenClaw.

It currently supports two action classes:

- live `exec` / Tessera `exec.shell`
- initial `message_sending` / Tessera `message.send`

## Local credential store

Credentials are read from:

- [`local-credentials.json`](/Users/guglielmoreggio/code/tessera/openclaw-guard-plugin/local-credentials.json) when present
- otherwise [`local-credentials.example.json`](/tmp/tessera-guard-pr/openclaw-guard-plugin/local-credentials.example.json)

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
        "actions": ["exec.shell", "message.send"]
      }
    }
  }
}
```

`local-credentials.json` is intentionally ignored so machine-local credential state does not get committed. Copy the example file when you want to run the local demo.

## Install locally

Use a repo-local OpenClaw home so this does not touch your main runtime profile:

```bash
OPENCLAW_HOME=/Users/guglielmoreggio/code/tessera/.openclaw-probe-home \
script -q /dev/null openclaw plugins install --link /Users/guglielmoreggio/code/tessera/openclaw-guard-plugin
```

## Run the exec enforcement tests

```bash
cd /Users/guglielmoreggio/code/tessera/openclaw-guard-plugin
OPENCLAW_HOME=/Users/guglielmoreggio/code/tessera/.openclaw-probe-home node ./test-shell-exec-enforcement.js
```

Expected sequence:

1. no credential -> blocked
2. valid `exec.shell` credential -> allowed
3. revoked credential -> blocked

## Run the message hook test

```bash
cd /Users/guglielmoreggio/code/tessera/openclaw-guard-plugin
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

## Live local session

Use the repo-scoped OpenClaw home, start the gateway, then run a real agent turn for `exec`:

```bash
OPENCLAW_HOME=/Users/guglielmoreggio/code/tessera/.openclaw-probe-home \
openclaw gateway run --allow-unconfigured --verbose
```

```bash
OPENCLAW_HOME=/Users/guglielmoreggio/code/tessera/.openclaw-probe-home \
openclaw agent --agent main --message "Run pwd using the exec tool now. If a tool policy blocks execution, reply with the exact denial reason and nothing else." --json
```

The live path now proves:

1. no credential for `main` -> blocked
2. valid `exec.shell` credential for `main` -> allowed
3. revoked credential for `main` -> blocked

## Message path status

The plugin now enforces `message.send` at the real `message_sending` hook boundary, but full live end-to-end delivery is still blocked in this local setup because the repo-scoped OpenClaw profile does not have a working outbound channel account. The direct CLI path currently fails early with:

- `Error: Channel is unavailable: telegram`

So `message.send` is validated against the real OpenClaw hook contract, but not yet through a successful live outbound channel send.

## What is still stubbed

- local JSON credentials only
- no issuer service
- no VC/ZK verification
- no working local outbound channel account for a fully live `message.send` demo yet
- no persistent revocation registry beyond the `revoked` field in the local credential file
