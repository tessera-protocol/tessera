# Quickstart

This quickstart shows the current Tessera Guard wedge for OpenClaw:

- `exec.shell` is live end-to-end
- `message.send` is enforced at the real `message_sending` hook boundary
- both use the same durable grant / revoke model

## Fast Path

From the repo root, run:

```bash
bash ./scripts/demo-guard --fresh
```

That one command:

- prepares or reuses the repo-scoped `.openclaw-probe-home`
- wires `tessera-guard-local`
- verifies or links repo-scoped agent `main`
- starts `/guard`
- starts the repo-scoped gateway
- prints the exact next demo steps for `exec.shell` and `message.send`

## What You Need

- Node/npm installed
- `openclaw` installed locally
- a working local OpenClaw `main` agent profile under `~/.openclaw/agents/main/agent/`

If that local `main` profile is missing or unusable, the harness fails clearly before claiming the demo is ready.

## What the Harness Prints

After startup, the harness tells you:

- the `/guard` URL
- the repo-scoped gateway URL
- whether it reused or bootstrapped repo-scoped state
- whether `main` was linked and passed a real preflight turn
- the exact blocked / allowed / revoked checks to run next

## First Checks

1. Open the `/guard` URL printed by the harness.
2. Click `Scan for local agents`.
3. Confirm the top status surface shows:
   - `Runtime reachable`
   - `Plugin loaded`
   - agent `main`

## exec.shell

Blocked:

```bash
./openclaw-guard-plugin/demo/run-live-exec-check.sh blocked
```

Expected:

```text
Tessera Guard blocked exec: no credential found for agent "main" authorizing exec.shell.
```

Then in `/guard`:

- click `Grant exec.shell`

Allowed twice:

```bash
./openclaw-guard-plugin/demo/run-live-exec-check.sh allowed
./openclaw-guard-plugin/demo/run-live-exec-check.sh allowed
```

Expected:

```text
exec allowed
```

Then in `/guard`:

- click `Revoke credential`

Blocked again:

```bash
./openclaw-guard-plugin/demo/run-live-exec-check.sh blocked
```

## message.send

This path is real at the hook boundary today. It is not presented here as a full outbound messaging demo.

Blocked:

```bash
node ./openclaw-guard-plugin/demo/run-message-hook-check.js
```

Expected:

```text
Tessera Guard blocked message.send because agent "main" has no local Tessera credential authorizing message.send.
```

Then in `/guard`:

- click `Grant message.send`

Allowed twice:

```bash
node ./openclaw-guard-plugin/demo/run-message-hook-check.js
node ./openclaw-guard-plugin/demo/run-message-hook-check.js
```

Expected:

```text
Tessera Guard allowed message.send at the hook boundary.
```

Then in `/guard`:

- click `Revoke credential`

Blocked again:

```bash
node ./openclaw-guard-plugin/demo/run-message-hook-check.js
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
- `message.send` is enforced at the real hook boundary, but not yet shown here as a full live outbound demo
