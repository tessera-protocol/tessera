import { NextResponse } from "next/server";
import { readGuardControlPlaneState } from "@/lib/guard-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(await readGuardControlPlaneState());
}
