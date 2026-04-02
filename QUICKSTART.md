# Quickstart

This quickstart shows the current Tessera Guard milestone:

- no credential -> `exec.shell` is blocked
- grant a credential from `/guard` -> the same command is allowed
- run it again -> still allowed, with no one-shot approval
- revoke the credential -> the same command is blocked again immediately

This is a local demo flow for OpenClaw `main`.

## What You Need

- Node/npm installed
- `openclaw` installed locally
- the repo cloned at `~/code/tessera`

## 1. Install the local OpenClaw Guard plugin

```bash
cd ~/code/tessera
OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home \
script -q /dev/null openclaw plugins install --link ~/code/tessera/openclaw-guard-plugin
```

## 2. Start the Guard dashboard

In Terminal 1:

```bash
cd ~/code/tessera/apps/web
npm install
npm run dev:guard
```

Open:

- `http://localhost:3000/guard`

The `/guard` route is the local control surface. It reads and writes the real local credential file used by the OpenClaw Guard plugin.
It is a loopback-only demo control path, not a production auth endpoint.

## 3. Start the repo-scoped OpenClaw gateway

In Terminal 2:

```bash
cd ~/code/tessera
export OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home
export OPENCLAW_DISABLE_BONJOUR=1
openclaw gateway run --allow-unconfigured --verbose --force --port 19001
```

You should see:

- `listening on ws://127.0.0.1:19001`
- canvas root under `~/code/tessera/.openclaw-probe-home/.openclaw/canvas`
- model `openai-codex/gpt-5.4`

If you see `~/.openclaw/...` instead, you are on the wrong runtime.

## 4. Start the OpenClaw TUI on the same runtime

In Terminal 3:

```bash
export OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home
openclaw tui
```

Wait for:

- `gateway connected | idle`

## 5. Run the durable Guard demo loop

Use this exact prompt in the TUI every time:

```text
Use exec to run echo tessera-demo. If blocked, output only the exact denial reason. If allowed, output only the command result.
```

### Step 1: No credential -> blocked

In `/guard`, make sure `Credential state` is `No credential`.

Send the prompt once in the TUI.

Expected result:

```text
Tessera Guard blocked exec: no credential found for agent "main" authorizing exec.shell.
```

### Step 2: Grant credential -> allowed

In `/guard`, click:

- `Grant demo credential`

Wait for `Credential state` to become `Valid`.

Send the same prompt again in the TUI.

Expected result:

```text
tessera-demo
```

### Step 3: Same command again -> still allowed

Send the same prompt a third time in the TUI.

Expected result:

```text
tessera-demo
```

This is the key proof that Tessera Guard is enforcing durable delegated authority, not one-shot approval.

### Step 4: Revoke credential -> blocked again

In `/guard`, click:

- `Revoke credential`

Wait for `Credential state` to become `Revoked`.

Send the same prompt one last time in the TUI.

Expected result:

```text
Tessera Guard blocked exec: credential "..." has been revoked.
```

## 6. What the dashboard should show

The `/guard` page should reflect the real local control-plane state:

- runtime: `OpenClaw`
- agent: `main`
- plugin: `tessera-guard-local`
- credential state: `No credential`, `Valid`, or `Revoked`
- recent guarded actions in this order:
  - blocked
  - allowed
  - allowed
  - blocked

## Demo Artifacts

Reproducible demo assets live in:

- [`openclaw-guard-plugin/demo/live-demo.mp4`](./openclaw-guard-plugin/demo/live-demo.mp4)
- [`openclaw-guard-plugin/demo/live-demo.gif`](./openclaw-guard-plugin/demo/live-demo.gif)
- [`openclaw-guard-plugin/demo/demo.tape`](./openclaw-guard-plugin/demo/demo.tape)

## Current Scope

What is real today:

- live OpenClaw plugin boundary
- live `exec` / Tessera `exec.shell` enforcement
- live mutation-tool (`code.write`) enforcement at the same `before_tool_call` boundary
- dashboard-driven grant and revoke for agent `main`
- immediate revocation effect

What is still local or stubbed:

- local JSON credentials
- issuer is demo-only and must stay on localhost unless real auth is added
- no VC / ZK verification
- no persistent revocation registry
- `message.send` is only an initial hook-level path, not a full live outbound demo
