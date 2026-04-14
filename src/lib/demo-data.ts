// ============================================================
// Demo Mode — Seeded data for judges to see the product in 30s
// ============================================================

import { Position, Vault, Policy } from "@/types";

/**
 * Demo policy: strict enough to trigger violations on the seeded positions.
 */
export const DEMO_POLICY: Policy = {
  id: "demo",
  name: "Conservative Treasury",
  assetSymbol: "USDC",
  allowedChainIds: [1, 8453, 42161],
  allowedProtocols: ["Aave V3", "Compound V3", "Morpho"],
  minTvlUsd: 5_000_000,
  minApy: 2.0,
  maxProtocolExposurePct: 40,
  minIdleCashPct: 10,
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

/**
 * 4 seeded positions: 1 violating, 1 warning, 2 compliant.
 * The Yearn position on Ethereum is the PRIMARY cross-chain rescue target.
 * Position values are balanced so $350k Yearn (35%) can be repaired to
 * Morpho Blue on Base without exceeding 40% concentration max.
 */
export const DEMO_POSITIONS: Position[] = [
  {
    // ★ VIOLATING: Protocol "Yearn" not in allowedProtocols
    //   This is the PRIMARY cross-chain rescue: Ethereum → Base
    //   Concentration: 35% of $1M (under 40% max, so repair to single vault works)
    chainId: 1,
    protocolName: "Yearn",
    vaultAddress: "0x1234567890abcdef1234567890abcdef12345678",
    assetAddress: "0xa354f35829ae975e850e23e9615b11da1b3dc4de",
    assetSymbol: "yvUSDC",
    assetDecimals: 6,
    balanceUsd: 350_000,
    balanceNative: "350000",
    balanceAtomic: "350000000000",
  },
  {
    // COMPLIANT: All rules pass. Aave V3 is allowed, vault has good TVL & APY.
    chainId: 42161,
    protocolName: "Aave V3",
    vaultAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    assetAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    assetSymbol: "USDC",
    assetDecimals: 6,
    balanceUsd: 150_000,
    balanceNative: "150000",
    balanceAtomic: "150000000000",
  },
  {
    // WARNING: APY 2.1% is near minimum 2.0% (within warning zone 90-100%)
    chainId: 8453,
    protocolName: "Compound V3",
    vaultAddress: "0x9876543210fedcba9876543210fedcba98765432",
    assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    assetSymbol: "USDC",
    assetDecimals: 6,
    balanceUsd: 300_000,
    balanceNative: "300000",
    balanceAtomic: "300000000000",
  },
  {
    // COMPLIANT: All rules pass
    chainId: 1,
    protocolName: "Aave V3",
    vaultAddress: "0xfedcba9876543210fedcba9876543210fedcba98",
    assetAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    assetSymbol: "USDC",
    assetDecimals: 6,
    balanceUsd: 200_000,
    balanceNative: "200000",
    balanceAtomic: "200000000000",
  },
];

/**
 * Seeded vaults with full APY intelligence (base/reward/1d/7d/30d + tags).
 * Includes cross-chain targets and a deliberate concentration trap.
 */
export const DEMO_VAULTS: Vault[] = [
  // ★ PRIMARY cross-chain rescue target: Morpho on Base
  {
    address: "0xAABBCCDDEEFF00112233445566778899AABBCCDD",
    chainId: 8453,
    name: "Morpho Blue USDC",
    protocolName: "Morpho",
    underlyingSymbol: "USDC",
    apyTotal: 5.82,
    apyBase: 3.77,
    apyReward: 2.05,
    apy1d: 5.91,
    apy7d: 5.74,
    apy30d: 5.68,
    tags: ["stablecoin", "single"],
    tvlUsd: 142_000_000,
    isTransactional: true,
  },
  // Good secondary target
  {
    address: "0xBBCCDDEEFF00112233445566778899AABBCCDDEE",
    chainId: 1,
    name: "Aave V3 USDC",
    protocolName: "Aave V3",
    underlyingSymbol: "USDC",
    apyTotal: 3.45,
    apyBase: 3.45,
    apyReward: 0,
    apy1d: 3.42,
    apy7d: 3.51,
    apy30d: 3.39,
    tags: ["stablecoin", "single"],
    tvlUsd: 890_000_000,
    isTransactional: true,
  },
  // Arbitrum option
  {
    address: "0xCCDDEEFF00112233445566778899AABBCCDDEEFF",
    chainId: 42161,
    name: "Compound V3 USDC",
    protocolName: "Compound V3",
    underlyingSymbol: "USDC",
    apyTotal: 4.12,
    apyBase: 2.89,
    apyReward: 1.23,
    apy1d: 4.05,
    apy7d: 4.18,
    apy30d: 3.95,
    tags: ["stablecoin", "single"],
    tvlUsd: 320_000_000,
    isTransactional: true,
  },
  // ⚠ CONCENTRATION TRAP: highest APY but would breach 40% max combined with existing Aave V3
  {
    address: "0xDDEEFF00112233445566778899AABBCCDDEEFF00",
    chainId: 8453,
    name: "Aave V3 Base USDC",
    protocolName: "Aave V3",
    underlyingSymbol: "USDC",
    apyTotal: 6.10,
    apyBase: 4.20,
    apyReward: 1.90,
    apy1d: 6.30,
    apy7d: 5.95,
    apy30d: 5.80,
    tags: ["stablecoin", "single"],
    tvlUsd: 85_000_000,
    isTransactional: true,
  },
  // Source vaults (where violating positions are)
  {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    chainId: 1,
    name: "Yearn USDC Vault",
    protocolName: "Yearn",
    underlyingSymbol: "USDC",
    apyTotal: 3.80,
    apyBase: 3.80,
    apyReward: 0,
    apy1d: 3.75,
    apy7d: 3.82,
    apy30d: 3.70,
    tags: ["stablecoin"],
    tvlUsd: 18_000_000,
    isTransactional: true,
  },
  {
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    chainId: 42161,
    name: "Aave V3 Arbitrum USDC",
    protocolName: "Aave V3",
    underlyingSymbol: "USDC",
    apyTotal: 3.50,
    apyBase: 2.80,
    apyReward: 0.70,
    apy1d: 3.45,
    apy7d: 3.55,
    apy30d: 3.42,
    tags: ["stablecoin", "single"],
    tvlUsd: 85_000_000,
    isTransactional: true,
  },
  {
    address: "0x9876543210fedcba9876543210fedcba98765432",
    chainId: 8453,
    name: "Compound V3 Base USDC",
    protocolName: "Compound V3",
    underlyingSymbol: "USDC",
    apyTotal: 2.10,
    apyBase: 2.10,
    apyReward: 0,
    apy1d: 2.08,
    apy7d: 2.12,
    apy30d: 2.05,
    tags: ["stablecoin", "single"],
    tvlUsd: 95_000_000,
    isTransactional: true,
  },
  {
    address: "0xfedcba9876543210fedcba9876543210fedcba98",
    chainId: 1,
    name: "Aave V3 Ethereum USDC",
    protocolName: "Aave V3",
    underlyingSymbol: "USDC",
    apyTotal: 3.45,
    apyBase: 3.45,
    apyReward: 0,
    apy1d: 3.42,
    apy7d: 3.51,
    apy30d: 3.39,
    tags: ["stablecoin", "single"],
    tvlUsd: 890_000_000,
    isTransactional: true,
  },
];

/** Simulated wallet USDC balance for demo mode */
export const DEMO_WALLET_USDC = 150_000;
