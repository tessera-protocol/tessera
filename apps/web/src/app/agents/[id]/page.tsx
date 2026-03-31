import { AgentDetailClient } from "./agent-detail-client";

const agentIds = ["claude-code", "mcp-browser", "openclaw-v1"];

export function generateStaticParams() {
  return agentIds.map((id) => ({ id }));
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AgentDetailClient id={id} />;
}
