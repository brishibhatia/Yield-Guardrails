import { NextRequest, NextResponse } from "next/server";
import { fetchTransactionStatusServer } from "@/lib/lifi-client";

export async function GET(req: NextRequest) {
  try {
    const txHash = req.nextUrl.searchParams.get("txHash");
    const fromChain = req.nextUrl.searchParams.get("fromChain");
    const toChain = req.nextUrl.searchParams.get("toChain");
    if (!txHash || !fromChain || !toChain) {
      return NextResponse.json({ error: "txHash, fromChain, toChain required" }, { status: 400 });
    }
    const status = await fetchTransactionStatusServer(txHash, Number(fromChain), Number(toChain));
    return NextResponse.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
