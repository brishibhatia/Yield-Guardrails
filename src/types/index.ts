// ============================================================
// Yield Guardrails — Core Type Definitions
// ============================================================

export type RoutePreferences = {
  order: "FASTEST" | "CHEAPEST";
  preset: "stablecoin" | "";
  allowBridges: string[];
  preferredBridges: string[];
  allowExchanges: string[];
  preferredExchanges: string[];
};

export type Policy = {
  id: string;
  name: string;
  assetSymbol: "USDC";
  allowedChainIds: number[];
  allowedProtocols: string[];
  minTvlUsd: number;
  minApy: number;
  maxProtocolExposurePct: number;
  minIdleCashPct: number;
  routePreferences: RoutePreferences;
  createdAt: number;
  updatedAt: number;
};

export type Vault = {
  address: string;
  chainId: number;
  name: string;
  protocolName: string;
  underlyingSymbol: string;
  apyTotal: number | null;
  apyBase: number | null;
  apyReward: number | null;
  apy1d: number | null;
  apy7d: number | null;
  apy30d: number | null;
  tags: string[];
  tvlUsd: number;
  isTransactional: boolean;
};

export type Position = {
  chainId: number;
  protocolName: string;
  vaultAddress: string;
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number | null;
  balanceUsd: number;
  balanceNative: string;   // human-readable display amount
  balanceAtomic: string | null; // raw wei/atomic amount for quotes
};

export type ViolationKind = "chain" | "protocol" | "tvl" | "apy" | "concentration";
export type Severity = "compliant" | "warning" | "violating";

export type Violation = {
  kind: ViolationKind;
  severity: "warning" | "violating";
  message: string;
};

export type PositionWithStatus = Position & {
  severity: Severity;
  violations: Violation[];
};

export type RepairPlan = {
  sourceToken: string;
  sourceChainId: number;
  targetVaultAddress: string;
  targetChainId: number;
  amount: string;
  targetVault?: Vault;
};

export type Transaction = {
  id: string;
  hash: string;
  chainId: number;
  status: "pending" | "confirmed" | "failed";
  type: "deposit" | "repair";
  amount: string;
  sourceChainId: number;
  targetChainId: number;
  targetVault: string;
  timestamp: number;
  explorerUrl?: string;
  routeInfo?: RouteInfo;
};

/** Route info extracted from LI.FI quote for transparency */
export type RouteInfo = {
  tool: string;
  toolName: string;
  type: string;
  estimatedDuration: number;
  gasCostUsd: string;
  feeCostUsd: string;
  steps: RouteStep[];
};

export type RouteStep = {
  type: string;
  tool: string;
  toolName: string;
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
};

export const SUPPORTED_CHAIN_IDS = [1, 8453, 42161] as const;

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
};

export const CHAIN_ICONS: Record<number, string> = {
  1: "⟠",
  8453: "🔵",
  42161: "🔷",
};

export const DEFAULT_POLICY: Policy = {
  id: "default",
  name: "Default Policy",
  assetSymbol: "USDC",
  allowedChainIds: [1, 8453, 42161],
  allowedProtocols: [],
  minTvlUsd: 1_000_000,
  minApy: 1.0,
  maxProtocolExposurePct: 50,
  minIdleCashPct: 5,
  routePreferences: {
    order: "CHEAPEST",
    preset: "stablecoin",
    allowBridges: [],
    preferredBridges: [],
    allowExchanges: [],
    preferredExchanges: [],
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

