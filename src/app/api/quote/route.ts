import { NextRequest, NextResponse } from "next/server";
import { fetchComposerQuoteServer } from "@/lib/lifi-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const quote = await fetchComposerQuoteServer(body);
    return NextResponse.json(quote);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
