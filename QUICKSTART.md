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

## 2. Bootstrap the repo-scoped OpenClaw profile

This demo uses a repo-local OpenClaw home so it does not modify your main runtime profile.

First, point that repo-scoped home at the local Guard plugin and set the gateway to loopback/no-auth for the local demo:

```bash
OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home openclaw config set gateway.auth.mode '"none"' --strict-json
OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home openclaw config set gateway.bind '"loopback"' --strict-json
OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home openclaw config set gateway.port 19001 --strict-json
OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home openclaw config set plugins.load.paths "[\"$HOME/code/tessera/openclaw-guard-plugin\"]" --strict-json
OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home openclaw config set plugins.allow '["tessera-guard-local"]' --strict-json
OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home openclaw config set plugins.entries.tessera-guard-local.enabled true --strict-json
```

Then point repo-scoped agent `main` at your existing local model/auth profiles:

```bash
mkdir -p ~/code/tessera/.openclaw-probe-home/.openclaw/agents/main/agent
ln -sf ~/.openclaw/agents/main/agent/models.json ~/code/tessera/.openclaw-probe-home/.openclaw/agents/main/agent/models.json
ln -sf ~/.openclaw/agents/main/agent/auth-profiles.json ~/code/tessera/.openclaw-probe-home/.openclaw/agents/main/agent/auth-profiles.json
```

If you do not already have a working local `main` agent profile under `~/.openclaw/agents/main/agent/`, set that up first with your normal OpenClaw configuration flow.

## 3. Start the Guard dashboard

In Terminal 1:

```bash
cd ~/code/tessera/apps/web
npm install
npm run dev:guard
```

Open:

- `http://localhost:3000/guard`

The `/guard` route is the local control surface. It reads and writes the real local credential file used by the OpenClaw Guard plugin.

## 4. Start the repo-scoped OpenClaw gateway

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

If you see `~/.openclaw/...` instead, you are on the wrong runtime.

You can also verify the plugin is loaded:

```bash
OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home openclaw plugins inspect tessera-guard-local
```

## 5. Start the OpenClaw TUI on the same runtime

In Terminal 3:

```bash
export OPENCLAW_HOME=~/code/tessera/.openclaw-probe-home
openclaw tui
```

Wait for:

- `gateway connected | idle`

## 6. Run the durable Guard demo loop

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

## 7. What the dashboard should show

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
- dashboard-driven grant and revoke for agent `main`
- immediate revocation effect

What is still local or stubbed:

- local JSON credentials
- no issuer service
- no VC / ZK verification
- no persistent revocation registry
- `message.send` is only an initial hook-level path, not a full live outbound demo
