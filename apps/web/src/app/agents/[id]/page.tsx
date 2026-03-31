import { agents } from "@/lib/mock-data";
import { AgentDetailClient } from "./agent-detail-client";

export function generateStaticParams() {
  return agents.map((agent) => ({ id: agent.id }));
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AgentDetailClient id={id} />;
}
