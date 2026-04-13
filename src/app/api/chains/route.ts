import { NextResponse } from "next/server";

const EARN_BASE_URL = "https://earn.li.fi";

function serverHeaders(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json", Accept: "application/json" };
  const key = process.env.LIFI_API_KEY || "";
  if (key) h["x-lifi-api-key"] = key;
  return h;
}

export async function GET() {
  try {
    const res = await fetch(`${EARN_BASE_URL}/v1/earn/chains`, { headers: serverHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch chains: ${res.status}`);
    const data = await res.json();
    // Normalize: API may return array directly or { data: [...] }
    const chains: unknown[] = Array.isArray(data) ? data : data?.data ?? data?.chains ?? [];
    const normalized = chains.map((c: unknown) => {
      const r = c as Record<string, unknown>;
      return {
        id: Number(r.id || r.chainId || 0),
        name: String(r.name || r.label || "Unknown"),
        logoURI: String(r.logoURI || r.logo || ""),
      };
    }).filter(c => c.id > 0);
    return NextResponse.json(normalized);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
