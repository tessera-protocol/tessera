import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server.js";

const cleanupPaths: string[] = [];
const envKeys = [
  "GUARD_LOCAL_CONTROL_PLANE",
  "TESSERA_REPO_ROOT",
  "TESSERA_GUARD_PLUGIN_DIR",
  "TESSERA_OPENCLAW_HOME_DIR",
];

afterEach(() => {
  for (const key of envKeys) {
    delete process.env[key];
  }

  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop()!, { recursive: true, force: true });
  }
});

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "tessera-guard-route-"));
  const pluginDir = path.join(root, "openclaw-guard-plugin");
  const openclawHomeDir = path.join(root, ".openclaw", ".openclaw");

  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(openclawHomeDir, { recursive: true });

  writeJson(path.join(pluginDir, "local-credentials.json"), { agents: {} });
  writeJson(path.join(openclawHomeDir, "openclaw.json"), { tools: { exec: { security: "deny", ask: "on-miss" } } });
  writeJson(path.join(openclawHomeDir, "exec-approvals.json"), {
    version: 1,
    agents: {
      main: {
        security: "deny",
        ask: "on-miss",
      },
    },
  });

  process.env.GUARD_LOCAL_CONTROL_PLANE = "1";
  process.env.TESSERA_REPO_ROOT = root;
  process.env.TESSERA_GUARD_PLUGIN_DIR = pluginDir;
  process.env.TESSERA_OPENCLAW_HOME_DIR = openclawHomeDir;
  cleanupPaths.push(root);

  return {
    credentialPath: path.join(pluginDir, "local-credentials.json"),
  };
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function loadRouteModule() {
  const routePath = pathToFileURL(path.resolve("src/app/api/guard/credential/route.ts")).href;
  return await import(`${routePath}?t=${Date.now()}`);
}

test("localhost dashboard writes are allowed only in explicit demo mode", async () => {
  const fixture = createFixture();
  const { POST } = await loadRouteModule();

  const request = new NextRequest("http://127.0.0.1/api/guard/credential", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify({ action: "grant", agentId: "main" }),
  });

  const response = await POST(request);
  const payload = (await response.json()) as { credential?: { scope?: { actions?: string[] } } };

  assert.equal(response.status, 200);
  assert.deepEqual(payload.credential?.scope?.actions, ["exec.shell"]);
  assert.equal(existsSync(fixture.credentialPath), true);
});

test("localhost dashboard can grant scoped code.write without widening exec runtime posture", async () => {
  const fixture = createFixture();
  const { POST } = await loadRouteModule();

  const request = new NextRequest("http://127.0.0.1/api/guard/credential", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify({ action: "grant", agentId: "main", actions: ["code.write"] }),
  });

  const response = await POST(request);
  const payload = (await response.json()) as {
    credential?: { scope?: { actions?: string[] } };
    runtime?: { durableExecPolicy?: boolean };
  };

  assert.equal(response.status, 200);
  assert.deepEqual(payload.credential?.scope?.actions, ["code.write"]);
  assert.equal(payload.runtime?.durableExecPolicy, false);
});

test("non-loopback dashboard writes are rejected without mutating local authority state", async () => {
  const fixture = createFixture();
  const before = readFileSync(fixture.credentialPath, "utf8");
  const { POST } = await loadRouteModule();

  const request = new NextRequest("http://127.0.0.1/api/guard/credential", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1:3000",
      origin: "http://evil.example",
      "x-forwarded-for": "203.0.113.7",
    },
    body: JSON.stringify({ action: "grant", agentId: "main" }),
  });

  const response = await POST(request);
  const payload = (await response.json()) as { error?: string };

  assert.equal(response.status, 403);
  assert.match(payload.error ?? "", /demo-only|loopback|non-loopback/i);
  assert.equal(readFileSync(fixture.credentialPath, "utf8"), before);
});
