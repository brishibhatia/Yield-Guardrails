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
    const res = await fetch(`${EARN_BASE_URL}/v1/earn/protocols`, { headers: serverHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch protocols: ${res.status}`);
    const data = await res.json();
    const protocols: unknown[] = Array.isArray(data) ? data : data?.data ?? data?.protocols ?? [];
    const normalized = protocols.map((p: unknown) => {
      const r = p as Record<string, unknown>;
      return {
        key: String(r.key || r.id || ""),
        name: String(r.name || r.label || "Unknown"),
        logoURI: String(r.logoURI || r.logo || ""),
      };
    }).filter(p => p.name !== "Unknown");
    return NextResponse.json(normalized);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
