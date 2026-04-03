import { NextRequest, NextResponse } from "next/server.js";
import {
  readGuardControlPlaneState,
  type GuardRuntimeKind,
} from "@/lib/guard-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    runtimeKind?: GuardRuntimeKind;
    agentId?: string;
  };
  const runtimeKind =
    body.runtimeKind === "repo_scoped" || body.runtimeKind === "standard_local"
      ? body.runtimeKind
      : undefined;
  const agentId = body.agentId && body.agentId.trim().length > 0 ? body.agentId : undefined;

  return NextResponse.json(await readGuardControlPlaneState({ runtimeKind, agentId }));
}
