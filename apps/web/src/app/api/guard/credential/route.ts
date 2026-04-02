import { NextRequest, NextResponse } from "next/server";
import {
  clearDemoCredential,
  grantDemoCredential,
  revokeDemoCredential,
} from "@/lib/guard-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: "grant" | "revoke" | "clear";
    agentId?: string;
    actions?: string[];
  };

  const agentId = body.agentId || "main";

  switch (body.action) {
    case "grant":
      return NextResponse.json(await grantDemoCredential(agentId, body.actions));
    case "revoke":
      return NextResponse.json(await revokeDemoCredential(agentId));
    case "clear":
      return NextResponse.json(await clearDemoCredential(agentId));
    default:
      return NextResponse.json(
        { error: "Unknown credential action" },
        { status: 400 },
      );
  }
}
