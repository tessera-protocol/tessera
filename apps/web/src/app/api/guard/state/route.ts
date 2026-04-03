import { NextRequest, NextResponse } from "next/server.js";
import {
  readGuardControlPlaneState,
  type GuardRuntimeKind,
} from "@/lib/guard-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const runtimeKindParam = request.nextUrl.searchParams.get("runtimeKind");
  const agentIdParam = request.nextUrl.searchParams.get("agentId");
  const runtimeKind =
    runtimeKindParam === "repo_scoped" || runtimeKindParam === "standard_local"
      ? (runtimeKindParam as GuardRuntimeKind)
      : undefined;
  const agentId = agentIdParam && agentIdParam.trim().length > 0 ? agentIdParam : undefined;

  return NextResponse.json(await readGuardControlPlaneState({ runtimeKind, agentId }));
}
