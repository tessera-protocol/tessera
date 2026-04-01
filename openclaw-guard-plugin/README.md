# Tessera Guard Local OpenClaw Plugin

This is the smallest real Tessera Guard runtime integration for OpenClaw.

It proves one thing:

- a real OpenClaw plugin can block live shell execution at execution time unless a local Tessera credential authorizes `exec.shell`

## Local credential store

Credentials are read from:

- [`local-credentials.json`](/Users/guglielmoreggio/code/tessera/openclaw-guard-plugin/local-credentials.json)

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
        "actions": ["exec.shell"]
      }
    }
  }
}
```

## Install locally

Use a repo-local OpenClaw home so this does not touch your main runtime profile:

```bash
OPENCLAW_HOME=/Users/guglielmoreggio/code/tessera/.openclaw-probe-home \
script -q /dev/null openclaw plugins install --link /Users/guglielmoreggio/code/tessera/openclaw-guard-plugin
```

## Run the real enforcement test

```bash
cd /Users/guglielmoreggio/code/tessera/openclaw-guard-plugin
OPENCLAW_HOME=/Users/guglielmoreggio/code/tessera/.openclaw-probe-home node ./test-shell-exec-enforcement.js
```

Expected sequence:

1. no credential -> blocked
2. valid `exec.shell` credential -> allowed
3. revoked credential -> blocked

## Interception point

The real execution boundary is OpenClaw's plugin hook:

- `before_tool_call`

In the installed live runtime, this plugin maps:

- OpenClaw tool `exec` (and the hook-runner alias `shell.exec`)
- to Tessera action `exec.shell`

## Live local session

Use the repo-scoped OpenClaw home, start the gateway, then run a real agent turn:

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

## What is still stubbed

- local JSON credentials only
- no issuer service
- no VC/ZK verification
- no message/email enforcement yet
- no persistent revocation registry beyond the `revoked` field in the local credential file
