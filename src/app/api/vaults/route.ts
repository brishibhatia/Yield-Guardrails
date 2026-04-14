import { NextRequest, NextResponse } from "next/server";
import { fetchEarnVaultsServer } from "@/lib/lifi-client";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || undefined;
    const vaults = await fetchEarnVaultsServer(token);
    return NextResponse.json(vaults);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[/api/vaults] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
