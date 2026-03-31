import type { GuardInstance } from './guard.js';

export const TESSERA_SKILL_MARKDOWN = `# Tessera Guard

Tessera Guard lets an OpenClaw agent check whether a sensitive action is permitted before it executes.

Available tools:

- \`tessera_check_permission\`: Check whether an action is currently allowed.
- \`tessera_show_permissions\`: Summarize the credential's current permission state in natural language.
- \`tessera_request_upgrade\`: Draft a request asking the human for broader delegated permissions.

Use \`createSkillHandlers(guard)\` to bind executable handlers to these tools.
`;

export function getTesseraSkillConfig() {
  return {
    name: 'tessera_guard',
    description: 'Permission middleware for Tessera-bound OpenClaw agents',
    tools: [
      {
        name: 'tessera_check_permission',
        description: 'Check whether a specific action is allowed by the current Tessera credential',
      },
      {
        name: 'tessera_show_permissions',
        description: 'Describe the current Tessera permission state in natural language',
      },
      {
        name: 'tessera_request_upgrade',
        description: 'Draft a human-readable request for broader Tessera permissions',
      },
    ],
    markdown: TESSERA_SKILL_MARKDOWN,
  };
}

export function createSkillHandlers(guard: GuardInstance) {
  return {
    tessera_check_permission: async (args: { action: string; resource?: object }) => {
      const result = await guard.check(args.action, args.resource);
      return {
        allowed: result.allowed,
        reason: result.reason,
        suggestion: result.suggestion,
      };
    },
    tessera_show_permissions: async () => {
      return {
        message: guard.getAgentMessage(),
        status: guard.getStatus(),
      };
    },
    tessera_request_upgrade: async (args: { action: string }) => {
      return {
        message: `The user needs to issue a new Tessera credential that includes permission for: ${args.action}. They can do this from the Tessera app under Agent Wallets.`,
      };
    },
  };
}
