import { NextResponse } from "next/server.js";
import { readGuardControlPlaneState } from "@/lib/guard-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readGuardControlPlaneState());
}
