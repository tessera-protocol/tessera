export const TESSERA_SKILL_MARKDOWN = `# Tessera Guard

Tessera Guard lets an OpenClaw agent check whether a sensitive action is permitted before it executes.

Available tools:

- \`tessera_check_permission\`: Check whether an action is currently allowed.
- \`tessera_show_permissions\`: Summarize the credential's current permission state in natural language.
- \`tessera_request_upgrade\`: Draft a request asking the human for broader delegated permissions.
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
