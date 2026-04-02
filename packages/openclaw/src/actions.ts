export const ACTION_MAP: Record<string, string> = {
  'gmail.send_email': 'email.send',
  'email.send': 'email.send',
  'slack.post_message': 'message.send',
  'discord.send_message': 'message.send',
  'telegram.send_message': 'message.send',
  'whatsapp.send_message': 'message.send',
  'stripe.create_payment': 'payment.intent',
  'shopify.create_order': 'payment.intent',
  'shell.exec': 'exec.shell',
  'terminal.run': 'exec.shell',
  'apply_patch': 'code.write',
  'file.write': 'code.write',
  'fs.write': 'code.write',
  'workspace.write': 'code.write',
  'browser.purchase': 'payment.intent',
  'twitter.post': 'content.publish',
  'github.create_issue': 'content.publish',
  'message.send': 'message.send',
  'payment.intent': 'payment.intent',
  'exec.shell': 'exec.shell',
  'code.write': 'code.write',
  'content.publish': 'content.publish',
};

const PROTECTED_ACTIONS = new Set(Object.values(ACTION_MAP));

export function classifyAction(toolName: string): string | null {
  return ACTION_MAP[toolName] ?? (PROTECTED_ACTIONS.has(toolName) ? toolName : null);
}

export function isSensitive(toolName: string): boolean {
  return classifyAction(toolName) !== null || !(toolName in ACTION_MAP);
}
