import { NextRequest, NextResponse } from "next/server";
import { fetchPortfolioPositionsServer } from "@/lib/lifi-client";

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");
    if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
    const positions = await fetchPortfolioPositionsServer(address);
    return NextResponse.json(positions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
