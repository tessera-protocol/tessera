export type SupportedRuntimeKind = "repo_scoped" | "standard_local";

export type ProtectRoleId =
  | "researcher"
  | "developer"
  | "assistant"
  | "purchaser"
  | "custom";

export type ProtectAction = "exec.shell" | "code.write" | "message.send";

export type RoleTemplate = {
  id: ProtectRoleId;
  label: string;
  intent: string;
  allowed: string[];
  blocked: string[];
  limits: string[];
  runtimeCoverage: string[];
  actions: ProtectAction[];
  unsupportedReason?: string;
  advanced?: boolean;
};

export type ResolveRoleTemplateOptions = {
  roleId: ProtectRoleId;
  projectRoot: string;
  expiryHours: number;
  spendCap?: number;
  currency?: string;
  customActions?: ProtectAction[];
};

const CURRENT_RUNTIME_COVERAGE = [
  "Current OpenClaw wedge enforces: shell_exec, code_write, message_send",
  "Other listed capability categories describe role intent and future policy shape",
];

export function getSupportedRoleIds(): ProtectRoleId[] {
  return ["researcher", "developer", "assistant", "purchaser", "custom"];
}

export function getSupportedProtectActions(): ProtectAction[] {
  return ["exec.shell", "code.write", "message.send"];
}

export function resolveRoleTemplate(options: ResolveRoleTemplateOptions): RoleTemplate {
  const expiryLine = `Expiry: ${options.expiryHours}h`;

  switch (options.roleId) {
    case "researcher":
      return {
        id: "researcher",
        label: "Researcher",
        intent: "Safe research, browsing, and read-only work",
        allowed: ["web_search", "http_get", "file_read"],
        blocked: [
          "shell_exec",
          "file_write",
          "message_send",
          "payment_intent",
          "content_publish",
        ],
        limits: ["Spend cap: none", "Scope: read-only intent", expiryLine, "Revocation: active"],
        runtimeCoverage: CURRENT_RUNTIME_COVERAGE,
        actions: [],
      };
    case "developer":
      return {
        id: "developer",
        label: "Developer",
        intent: "Local code assistance",
        allowed: ["file_read", "file_write", "code_write", "shell_exec"],
        blocked: ["message_send", "payment_intent", "content_publish"],
        limits: [
          `Shell scope: ${options.projectRoot} (operator intent; current runtime does not yet enforce path-level limits)`,
          "Spend cap: none",
          expiryLine,
          "Revocation: active",
        ],
        runtimeCoverage: CURRENT_RUNTIME_COVERAGE,
        actions: ["code.write", "exec.shell"],
      };
    case "assistant":
      return {
        id: "assistant",
        label: "Assistant",
        intent: "Communication and admin-style workflows",
        allowed: ["message_send", "draft_message", "calendar_admin"],
        blocked: ["shell_exec", "destructive_file_write", "payment_intent"],
        limits: [
          "Messaging: explicit outbound send only",
          "Spend cap: none",
          expiryLine,
          "Revocation: active",
        ],
        runtimeCoverage: CURRENT_RUNTIME_COVERAGE,
        actions: ["message.send"],
      };
    case "purchaser": {
      const spendCapLine =
        typeof options.spendCap === "number" && Number.isFinite(options.spendCap)
          ? `Spend cap: ${options.spendCap} ${String(options.currency ?? "USD").toUpperCase()}`
          : "Spend cap: required before activation";
      return {
        id: "purchaser",
        label: "Purchaser",
        intent: "Bounded spending workflows",
        allowed: ["payment_intent"],
        blocked: ["shell_exec", "destructive_file_write", "content_publish"],
        limits: [spendCapLine, expiryLine, "Revocation: active"],
        runtimeCoverage: [
          "Current OpenClaw local plugin wedge does not yet enforce payment_intent end to end",
          "Use this role as a capability template, not a live-proven OpenClaw attachment path yet",
        ],
        actions: [],
        unsupportedReason:
          "The purchaser role is defined, but the current OpenClaw local plugin wedge does not yet attach payment_intent as a live-proven runtime capability.",
      };
    }
    case "custom":
      return {
        id: "custom",
        label: "Custom",
        intent: "Advanced manual policy path",
        allowed: (options.customActions ?? []).map(formatManifestAction),
        blocked: [
          "message_send",
          "payment_intent",
          "content_publish",
          "shell_exec",
          "file_write",
        ].filter((value) => !(options.customActions ?? []).map(formatManifestAction).includes(value)),
        limits: [
          "Scope: advanced manual path",
          expiryLine,
          "Revocation: active",
        ],
        runtimeCoverage: CURRENT_RUNTIME_COVERAGE,
        actions: options.customActions ?? [],
        advanced: true,
      };
  }
}

export function formatManifestAction(action: ProtectAction): string {
  switch (action) {
    case "exec.shell":
      return "shell_exec";
    case "code.write":
      return "code_write";
    case "message.send":
      return "message_send";
  }
}

export function formatRuntimeLabel(runtimeKind: SupportedRuntimeKind): string {
  return runtimeKind === "standard_local"
    ? "OpenClaw standard local runtime"
    : "OpenClaw repo-scoped demo runtime";
}

export function renderSafetyManifest(options: {
  template: RoleTemplate;
  runtimeKind: SupportedRuntimeKind;
  agentId: string;
}) {
  const lines = [
    "Tessera Shield Active",
    "",
    `Role: ${options.template.label}`,
    "Authority: Scoped, revocable",
    `Runtime: ${formatRuntimeLabel(options.runtimeKind)}`,
    `Agent: ${options.agentId}`,
    "",
    "Allowed",
    ...renderList(options.template.allowed.length ? options.template.allowed : ["none"]),
    "",
    "Blocked",
    ...renderList(options.template.blocked),
    "",
    "Limits",
    ...renderList(options.template.limits),
    "",
    "Runtime coverage",
    ...renderList(options.template.runtimeCoverage),
    "",
    "Boundary",
    "- Tessera enforces action class, scope, expiry, revocation state, and quantitative limits.",
    "- It does not yet enforce the semantic acceptability of payloads.",
    "",
    "Revoke",
    "- tessera revoke <credential-id>",
    "",
    "Proceed? [Y/n]",
  ];

  return lines.join("\n");
}

function renderList(values: string[]) {
  return values.map((value) => `- ${value}`);
}

