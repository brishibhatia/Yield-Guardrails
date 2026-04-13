import { NextResponse } from "next/server";
import { fetchToolsServer } from "@/lib/lifi-client";

export async function GET() {
  try {
    const tools = await fetchToolsServer();
    return NextResponse.json(tools);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
