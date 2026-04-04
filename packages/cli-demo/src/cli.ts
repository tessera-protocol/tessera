#!/usr/bin/env -S npx tsx

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runLifecycleDemo } from "./demo.js";
import {
  attachRoleCredential,
  createCustomPolicyScaffold,
  revokeRoleCredential,
} from "./runtime-attach.js";
import {
  getSupportedProtectActions,
  getSupportedRoleIds,
  renderSafetyManifest,
  resolveRoleTemplate,
  type ProtectAction,
  type ProtectRoleId,
  type SupportedRuntimeKind,
} from "./roles.js";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

type ParsedArgs = {
  command: string;
  values: Record<string, string | boolean>;
  positionals: string[];
};

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  switch (parsed.command) {
    case "demo":
      await runLifecycleDemo();
      return;
    case "roles":
      printRoles();
      return;
    case "protect":
      await runProtect(parsed);
      return;
    case "revoke":
      await runRevoke(parsed);
      return;
    default:
      printHelp();
  }
}

async function runProtect(parsed: ParsedArgs) {
  const roleValue = String(parsed.values.role ?? parsed.values.template ?? "");
  if (!roleValue) {
    throw new Error("protect requires --role <name>.");
  }

  if (!getSupportedRoleIds().includes(roleValue as ProtectRoleId)) {
    throw new Error(`Unsupported role "${roleValue}". Use one of: ${getSupportedRoleIds().join(", ")}.`);
  }

  const runtimeKind = parseRuntimeKind(parsed.values.runtime);
  const agentId = String(parsed.values.agent ?? "main");
  const expiryHours = parsePositiveNumber(parsed.values["expiry-hours"], 24);
  const projectRoot = String(parsed.values["project-root"] ?? process.cwd());
  const customActions = parseActions(parsed.values.actions);
  const template = resolveRoleTemplate({
    roleId: roleValue as ProtectRoleId,
    projectRoot,
    expiryHours,
    spendCap: parseOptionalNumber(parsed.values["spend-cap"]),
    currency: typeof parsed.values.currency === "string" ? parsed.values.currency : "USD",
    customActions,
  });

  if (template.id === "custom" && template.actions.length === 0) {
    const scaffoldPath = createCustomPolicyScaffold({
      outputPath: typeof parsed.values.output === "string" ? parsed.values.output : undefined,
      projectRoot,
    });
    output.write(`Created custom policy scaffold at ${scaffoldPath}\n`);
    output.write("Edit the scaffold, then rerun with --actions exec.shell,code.write,message.send as needed.\n");
    return;
  }

  const manifest = renderSafetyManifest({
    template,
    runtimeKind,
    agentId,
  });
  output.write(`${manifest}\n`);

  if (template.unsupportedReason) {
    throw new Error(template.unsupportedReason);
  }

  const confirmed = parsed.values.yes === true ? true : await confirmProceed();
  if (!confirmed) {
    output.write("Aborted.\n");
    return;
  }

  const attachment = attachRoleCredential({
    runtimeKind,
    agentId,
    actions: template.actions,
    roleId: template.id,
    expiryHours,
  });

  output.write(`\n${GREEN}Scoped authority attached.${RESET}\n`);
  output.write(`Role: ${template.label}\n`);
  output.write(`Credential: ${attachment.credentialId}\n`);
  output.write(`Credential store: ${attachment.credentialsPath}\n`);
  output.write(`Runtime config: ${attachment.openclawConfigPath}\n`);
  output.write(`Revoke: tessera revoke ${attachment.credentialId} --runtime ${runtimeKind} --agent ${agentId}\n`);
}

async function runRevoke(parsed: ParsedArgs) {
  const credentialId = parsed.positionals[0];
  if (!credentialId) {
    throw new Error("revoke requires a credential id: tessera revoke <credential-id>.");
  }

  const runtimeKind = parseRuntimeKind(parsed.values.runtime);
  const agentId = typeof parsed.values.agent === "string" ? parsed.values.agent : undefined;
  const revoked = revokeRoleCredential({
    runtimeKind,
    credentialId,
    agentId,
  });

  output.write(`${GREEN}Credential revoked.${RESET}\n`);
  output.write(`Credential: ${revoked.credentialId}\n`);
  output.write(`Agent: ${revoked.agentId}\n`);
  output.write(`Credential store: ${revoked.credentialsPath}\n`);
}

async function confirmProceed() {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question("")).trim().toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function printRoles() {
  output.write("Available Tessera roles:\n");
  for (const roleId of getSupportedRoleIds()) {
    output.write(`- ${roleId}\n`);
  }
  output.write(`Current OpenClaw live wedge actions: ${getSupportedProtectActions().join(", ")}\n`);
}

function printHelp() {
  output.write("Usage:\n");
  output.write("  tessera demo\n");
  output.write("  tessera protect --role <researcher|developer|assistant|purchaser|custom> [--runtime standard_local|repo_scoped] [--agent main] [--yes]\n");
  output.write("  tessera revoke <credential-id> [--runtime standard_local|repo_scoped] [--agent main]\n");
  output.write("  tessera roles\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "demo", ...rest] = argv;
  const values: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const key = value.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = true;
      continue;
    }

    values[key] = next;
    index += 1;
  }

  return { command, values, positionals };
}

function parseRuntimeKind(value: string | boolean | undefined): SupportedRuntimeKind {
  if (value === undefined || value === false) {
    return "standard_local";
  }

  if (value === "standard_local" || value === "repo_scoped") {
    return value;
  }

  throw new Error(`Unsupported runtime "${String(value)}". Use standard_local or repo_scoped.`);
}

function parseActions(value: string | boolean | undefined): ProtectAction[] | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const actions = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) as ProtectAction[];
  const unsupported = actions.filter((entry) => !getSupportedProtectActions().includes(entry));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported action(s): ${unsupported.join(", ")}.`);
  }

  return Array.from(new Set(actions));
}

function parsePositiveNumber(value: string | boolean | undefined, fallback: number) {
  const parsed = parseOptionalNumber(value);
  if (parsed === undefined) {
    return fallback;
  }
  if (parsed <= 0) {
    throw new Error("Numeric options must be positive.");
  }
  return parsed;
}

function parseOptionalNumber(value: string | boolean | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a number, received "${value}".`);
  }
  return parsed;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${RED}${message}${RESET}`);
  process.exitCode = 1;
});
