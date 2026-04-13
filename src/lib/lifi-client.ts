// ============================================================
// LI.FI API Client — server-side proxy + client helpers
// ============================================================

import { Vault, Position, SUPPORTED_CHAIN_IDS, RouteInfo, RouteStep } from "@/types";

const EARN_BASE_URL = "https://earn.li.fi";
const COMPOSER_BASE_URL = "https://li.quest";

// API key is ONLY used server-side via /api/ routes.
// Client code should call the Next.js API routes, not LI.FI directly.

function serverHeaders(): HeadersInit {
  const h: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // Only available server-side (no NEXT_PUBLIC_ prefix)
  const key = process.env.LIFI_API_KEY || "";
  if (key) {
    h["x-lifi-api-key"] = key;
  }
  return h;
}

// ---- Earn API (called from API routes) ----

export async function fetchEarnVaultsServer(
  underlyingSymbol?: string,
  chainIds?: number[]
): Promise<Vault[]> {
  const url = new URL(`${EARN_BASE_URL}/v1/earn/vaults`);
  const ids = chainIds ?? [...SUPPORTED_CHAIN_IDS];
  ids.forEach((id) => url.searchParams.append("chainId", String(id)));
  if (underlyingSymbol) {
    url.searchParams.set("token", underlyingSymbol);
  }

  const res = await fetch(url.toString(), { headers: serverHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch vaults: ${res.status}`);
  const data = await res.json();

  const rawVaults: unknown[] = Array.isArray(data)
    ? data
    : data?.data ?? data?.vaults ?? [];

  return rawVaults
    .map((v: unknown) => normalizeVault(v))
    .filter((v): v is Vault => v !== null);
}

export async function fetchPortfolioPositionsServer(
  userAddress: string
): Promise<Position[]> {
  const res = await fetch(
    `${EARN_BASE_URL}/v1/earn/portfolio/${userAddress}/positions`,
    { headers: serverHeaders() }
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to fetch positions: ${res.status}`);
  }
  const data = await res.json();
  const rawPositions = Array.isArray(data)
    ? data
    : data?.data ?? data?.positions ?? [];

  const mapped: (Position | null)[] = rawPositions.map((p: unknown) => normalizePosition(p));
  return mapped.filter((p): p is Position => p !== null);
}

export async function fetchComposerQuoteServer(
  params: QuoteParams
): Promise<QuoteResponse> {
  const url = new URL(`${COMPOSER_BASE_URL}/v1/quote`);
  url.searchParams.set("fromChain", String(params.fromChainId));
  url.searchParams.set("toChain", String(params.toChainId));
  url.searchParams.set("fromToken", params.fromToken);
  url.searchParams.set("toToken", params.toToken);
  url.searchParams.set("fromAmount", params.fromAmount);
  url.searchParams.set("fromAddress", params.fromAddress);
  url.searchParams.set("slippage", String(params.slippage ?? 0.03));

  // Route preferences
  if (params.order) url.searchParams.set("order", params.order);
  if (params.preset) url.searchParams.set("preset", params.preset);
  if (params.allowBridges?.length) {
    params.allowBridges.forEach((b) => url.searchParams.append("allowBridges", b));
  }
  if (params.allowExchanges?.length) {
    params.allowExchanges.forEach((e) => url.searchParams.append("allowExchanges", e));
  }

  // Integrator-ready params (from env)
  const integrator = process.env.LIFI_INTEGRATOR || "yield-guardrails";
  url.searchParams.set("integrator", integrator);
  const fee = process.env.LIFI_FEE;
  if (fee) url.searchParams.set("fee", fee);

  const res = await fetch(url.toString(), { headers: serverHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Quote failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function fetchTransactionStatusServer(
  txHash: string,
  fromChainId: number,
  toChainId: number
): Promise<{
  status: string;
  substatus?: string;
  receiving?: { txHash?: string };
  lifiExplorerLink?: string;
}> {
  const url = new URL(`${COMPOSER_BASE_URL}/v1/status`);
  url.searchParams.set("txHash", txHash);
  url.searchParams.set("fromChain", String(fromChainId));
  url.searchParams.set("toChain", String(toChainId));

  const res = await fetch(url.toString(), { headers: serverHeaders() });
  if (!res.ok) {
    throw new Error(`Status check failed: ${res.status}`);
  }
  return res.json();
}

/** Fetch available LI.FI tools (bridges + exchanges) */
export async function fetchToolsServer(): Promise<{ bridges: ToolInfo[]; exchanges: ToolInfo[] }> {
  const res = await fetch(`${COMPOSER_BASE_URL}/v1/tools`, { headers: serverHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch tools: ${res.status}`);
  const data = await res.json();
  return {
    bridges: (data.bridges || []).map((t: Record<string, unknown>) => ({
      key: String(t.key || ""),
      name: String(t.name || ""),
      logoURI: String(t.logoURI || ""),
    })),
    exchanges: (data.exchanges || []).map((t: Record<string, unknown>) => ({
      key: String(t.key || ""),
      name: String(t.name || ""),
      logoURI: String(t.logoURI || ""),
    })),
  };
}

// ---- Client-side helpers (call Next.js API routes) ----

export async function fetchEarnVaults(underlyingSymbol?: string): Promise<Vault[]> {
  const params = new URLSearchParams();
  if (underlyingSymbol) params.set("token", underlyingSymbol);
  const res = await fetch(`/api/vaults?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch vaults: ${res.status}`);
  return res.json();
}

export async function fetchPortfolioPositions(userAddress: string): Promise<Position[]> {
  const res = await fetch(`/api/positions?address=${encodeURIComponent(userAddress)}`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to fetch positions: ${res.status}`);
  }
  return res.json();
}

export async function fetchComposerQuote(params: QuoteParams): Promise<QuoteResponse> {
  const res = await fetch("/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Quote failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function fetchTransactionStatus(
  txHash: string,
  fromChainId: number,
  toChainId: number
): Promise<{ status: string; substatus?: string }> {
  const params = new URLSearchParams({
    txHash,
    fromChain: String(fromChainId),
    toChain: String(toChainId),
  });
  const res = await fetch(`/api/status?${params.toString()}`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

export async function fetchTools(): Promise<{ bridges: ToolInfo[]; exchanges: ToolInfo[] }> {
  const res = await fetch("/api/tools");
  if (!res.ok) throw new Error(`Failed to fetch tools: ${res.status}`);
  return res.json();
}

// ---- Normalization ----

function normalizeVault(raw: unknown): Vault | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const address = String(r.address || r.vaultAddress || "");
  if (!address) return null;

  const chainId = Number(r.chainId || r.chain_id || 0);
  if (!SUPPORTED_CHAIN_IDS.includes(chainId as 1 | 8453 | 42161)) return null;

  // TVL: can be object { usd: "..." } or direct number/string
  const tvlRaw = r.tvlUsd ?? r.tvl ?? r.totalValueLocked ?? 0;
  let tvlUsd: number;
  if (typeof tvlRaw === "object" && tvlRaw !== null) {
    const tvlObj = tvlRaw as Record<string, unknown>;
    tvlUsd = parseFloat(String(tvlObj.usd || "0"));
  } else {
    tvlUsd = typeof tvlRaw === "string" ? parseFloat(tvlRaw) : Number(tvlRaw || 0);
  }

  // APY: can be object { base, reward, total } or flat
  const analyticsRaw = r.analytics as Record<string, unknown> | undefined;
  const apyObj = analyticsRaw?.apy as Record<string, unknown> | undefined;
  
  let apyTotal = parseNullableNum(r.apyTotal ?? apyObj?.total ?? r.apy ?? null);
  const apyBase = parseNullableNum(apyObj?.base ?? r.apyBase ?? null);
  const apyReward = parseNullableNum(apyObj?.reward ?? r.apyReward ?? null);
  const apy1d = parseNullableNum(analyticsRaw?.apy1d ?? r.apy1d ?? null);
  const apy7d = parseNullableNum(analyticsRaw?.apy7d ?? r.apy7d ?? null);
  const apy30d = parseNullableNum(analyticsRaw?.apy30d ?? r.apy30d ?? null);

  // If analytics.tvl.usd is available, use it (it's the canonical source)
  if (analyticsRaw?.tvl && typeof analyticsRaw.tvl === "object") {
    const tvlAnalytics = analyticsRaw.tvl as Record<string, unknown>;
    if (tvlAnalytics.usd) tvlUsd = parseFloat(String(tvlAnalytics.usd));
  }

  // If apyTotal not directly available, compute from base+reward
  if (apyTotal === null && apyBase !== null) {
    apyTotal = apyBase + (apyReward ?? 0);
  }

  // Tags
  const tagsRaw = r.tags;
  const tags: string[] = Array.isArray(tagsRaw) ? tagsRaw.map(String) : [];

  // Protocol name
  const protocolRaw = r.protocol;
  let protocolName: string;
  if (typeof protocolRaw === "object" && protocolRaw !== null) {
    protocolName = String((protocolRaw as Record<string, unknown>).name || "Unknown");
  } else {
    protocolName = String(r.protocolName || protocolRaw || "Unknown");
  }

  const name = String(
    r.name || r.vaultName || r.displayName || `${protocolName} Vault`
  );
  const underlyingSymbol = String(
    r.underlyingSymbol || r.tokenSymbol || r.symbol || r.token || "USDC"
  );
  const isTransactional =
    r.isTransactional !== undefined ? Boolean(r.isTransactional) : true;

  return {
    address, chainId, name, protocolName, underlyingSymbol,
    apyTotal, apyBase, apyReward, apy1d, apy7d, apy30d, tags,
    tvlUsd, isTransactional,
  };
}

function parseNullableNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function normalizePosition(raw: unknown): Position | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const chainId = Number(r.chainId || r.chain_id || 0);
  const balanceRaw = r.balanceUsd ?? r.valueUsd ?? r.balance ?? 0;
  const balanceUsd =
    typeof balanceRaw === "string" ? parseFloat(balanceRaw) : Number(balanceRaw || 0);

  // Extract decimals from LI.FI payload
  const assetRaw = r.asset as Record<string, unknown> | undefined;
  const decimalsRaw = r.decimals ?? r.assetDecimals ?? r.tokenDecimals ?? assetRaw?.decimals ?? null;
  const assetDecimals = decimalsRaw !== null && decimalsRaw !== undefined
    ? Number(decimalsRaw) : null;

  // Extract raw atomic balance
  const atomicRaw = r.balanceAtomic ?? r.balanceRaw ?? r.rawBalance ?? r.amount ?? null;
  const balanceAtomic = atomicRaw !== null && atomicRaw !== undefined
    ? String(atomicRaw) : null;

  // Protocol name
  const protocolName = String(r.protocolName || r.protocol || "Unknown");

  // Asset address
  const assetAddress = String(r.assetAddress || r.tokenAddress || assetRaw?.address || r.asset || "");
  const assetSymbol = String(r.assetSymbol || r.tokenSymbol || assetRaw?.symbol || r.symbol || "USDC");

  return {
    chainId, protocolName,
    vaultAddress: String(r.vaultAddress || r.address || ""),
    assetAddress, assetSymbol, assetDecimals,
    balanceUsd,
    balanceNative: String(r.balanceNative || r.balance || "0"),
    balanceAtomic,
  };
}

/** Extract route info from a LI.FI quote response for UI transparency */
export function extractRouteInfo(quote: QuoteResponse): RouteInfo {
  const steps: RouteStep[] = [];
  if (Array.isArray(quote.includedSteps)) {
    for (const s of quote.includedSteps) {
      const step = s as Record<string, unknown>;
      const action = step.action as Record<string, unknown> | undefined;
      const toolDetails = step.toolDetails as Record<string, unknown> | undefined;
      steps.push({
        type: String(step.type || "unknown"),
        tool: String(step.tool || ""),
        toolName: String(toolDetails?.name || step.tool || ""),
        fromChainId: Number(action?.fromChainId || 0),
        toChainId: Number(action?.toChainId || 0),
        fromToken: String((action?.fromToken as Record<string, unknown>)?.symbol || ""),
        toToken: String((action?.toToken as Record<string, unknown>)?.symbol || ""),
      });
    }
  }

  // Gas costs
  let gasCostUsd = "0.00";
  if (Array.isArray(quote.estimate.gasCosts)) {
    const total = quote.estimate.gasCosts.reduce((sum: number, gc) => {
      const g = gc as Record<string, unknown>;
      return sum + parseFloat(String(g.amountUSD || "0"));
    }, 0);
    gasCostUsd = total.toFixed(2);
  }

  // Fee costs
  let feeCostUsd = "0.00";
  if (Array.isArray(quote.estimate.feeCosts)) {
    const total = quote.estimate.feeCosts.reduce((sum: number, fc) => {
      const f = fc as Record<string, unknown>;
      return sum + parseFloat(String(f.amountUSD || "0"));
    }, 0);
    feeCostUsd = total.toFixed(2);
  }

  const toolDetails = quote.toolDetails as Record<string, unknown> | undefined;

  return {
    tool: String(quote.tool || "unknown"),
    toolName: String(toolDetails?.name || quote.tool || "Unknown"),
    type: String(quote.type || "lifi"),
    estimatedDuration: quote.estimate.executionDuration || 0,
    gasCostUsd,
    feeCostUsd,
    steps,
  };
}

// ---- Client: Chains + Protocols ----

export interface LifiChain {
  id: number;
  name: string;
  logoURI: string;
}

export interface LifiProtocol {
  key: string;
  name: string;
  logoURI: string;
}

export async function fetchLifiChains(): Promise<LifiChain[]> {
  try {
    const res = await fetch("/api/chains");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchLifiProtocols(): Promise<LifiProtocol[]> {
  try {
    const res = await fetch("/api/protocols");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ---- Types ----

export interface QuoteParams {
  fromChainId: number;
  fromToken: string;
  toChainId: number;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  slippage?: number;
  // Route preferences
  order?: "FASTEST" | "CHEAPEST";
  preset?: string;
  allowBridges?: string[];
  allowExchanges?: string[];
}

export interface QuoteResponse {
  id: string;
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    gasPrice?: string;
    chainId: number;
  };
  action: Record<string, unknown>;
  estimate: {
    toAmount: string;
    toAmountMin: string;
    approvalAddress?: string;
    executionDuration?: number;
    feeCosts?: unknown[];
    gasCosts?: unknown[];
  };
  includedSteps?: unknown[];
  tool?: string;
  toolDetails?: unknown;
  type?: string;
  integrator?: string;
}

export interface ToolInfo {
  key: string;
  name: string;
  logoURI: string;
}

// USDC addresses per chain
export const USDC_ADDRESSES: Record<number, string> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
};
