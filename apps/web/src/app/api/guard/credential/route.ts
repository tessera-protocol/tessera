import { NextRequest, NextResponse } from "next/server.js";
import {
  clearDemoCredential,
  grantDemoCredential,
  revokeDemoCredential,
} from "@/lib/guard-control-plane";
import { getLocalDemoRequestRejection } from "@/lib/local-demo-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (process.env.GUARD_LOCAL_CONTROL_PLANE !== "1") {
    console.warn("[tessera-guard] rejected dashboard mutation outside local demo mode");
    return NextResponse.json(
      { error: "Guard mutations are only available in local demo mode." },
      { status: 403 },
    );
  }

  const rejection = getLocalDemoRequestRejection(request);
  if (rejection) {
    console.warn("[tessera-guard] rejected non-local dashboard mutation", {
      host: request.headers.get("host"),
      origin: request.headers.get("origin"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
    });
    return NextResponse.json({ error: rejection }, { status: 403 });
  }

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
