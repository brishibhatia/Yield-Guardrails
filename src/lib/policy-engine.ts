// ============================================================
// Policy Engine — Deterministic rule evaluation
// ============================================================

import {
  Policy,
  Position,
  Vault,
  Violation,
  Severity,
  PositionWithStatus,
} from "@/types";

const WARNING_THRESHOLD = 0.9; // 90% of threshold = warning zone

/**
 * Evaluate a single position against a policy.
 * Returns an array of violations. Empty = compliant.
 */
export function evaluatePosition(
  position: Position,
  policy: Policy,
  allPositions: Position[],
  vaults: Vault[]
): Violation[] {
  const violations: Violation[] = [];

  // 1. Chain check
  if (!policy.allowedChainIds.includes(position.chainId)) {
    violations.push({
      kind: "chain",
      severity: "violating",
      message: `Chain ${position.chainId} is not in the allowed chain list.`,
    });
  }

  // 2. Protocol check
  if (
    policy.allowedProtocols.length > 0 &&
    !policy.allowedProtocols
      .map((p) => p.toLowerCase())
      .includes(position.protocolName.toLowerCase())
  ) {
    violations.push({
      kind: "protocol",
      severity: "violating",
      message: `Protocol "${position.protocolName}" is not in the allowed protocol list.`,
    });
  }

  // 3. TVL check — find the vault for this position
  const vault = vaults.find(
    (v) =>
      v.address.toLowerCase() === position.vaultAddress.toLowerCase() &&
      v.chainId === position.chainId
  );
  if (vault) {
    if (vault.tvlUsd < policy.minTvlUsd) {
      const ratio = vault.tvlUsd / policy.minTvlUsd;
      violations.push({
        kind: "tvl",
        severity: ratio < WARNING_THRESHOLD ? "violating" : "warning",
        message: `Vault TVL ($${formatNum(vault.tvlUsd)}) is below minimum ($${formatNum(policy.minTvlUsd)}).`,
      });
    }
  }

  // 4. APY check
  if (vault && vault.apyTotal !== null) {
    if (vault.apyTotal < policy.minApy) {
      const ratio = vault.apyTotal / policy.minApy;
      violations.push({
        kind: "apy",
        severity: ratio < WARNING_THRESHOLD ? "violating" : "warning",
        message: `Vault APY (${vault.apyTotal.toFixed(2)}%) is below minimum (${policy.minApy}%).`,
      });
    }
  }

  // 5. Protocol concentration check
  const totalValue = allPositions.reduce((s, p) => s + p.balanceUsd, 0);
  if (totalValue > 0) {
    const protocolValue = allPositions
      .filter(
        (p) =>
          p.protocolName.toLowerCase() ===
          position.protocolName.toLowerCase()
      )
      .reduce((s, p) => s + p.balanceUsd, 0);
    const concentration = (protocolValue / totalValue) * 100;
    if (concentration > policy.maxProtocolExposurePct) {
      const ratio = policy.maxProtocolExposurePct / concentration;
      violations.push({
        kind: "concentration",
        severity: ratio < WARNING_THRESHOLD ? "violating" : "warning",
        message: `Protocol exposure (${concentration.toFixed(1)}%) exceeds max (${policy.maxProtocolExposurePct}%).`,
      });
    }
  }

  return violations;
}

/**
 * Determine severity from violations list.
 */
export function getSeverity(violations: Violation[]): Severity {
  if (violations.length === 0) return "compliant";
  if (violations.some((v) => v.severity === "violating")) return "violating";
  return "warning";
}

/**
 * Evaluate all positions and return them with status.
 */
export function evaluatePortfolio(
  positions: Position[],
  policy: Policy,
  vaults: Vault[]
): PositionWithStatus[] {
  return positions.map((pos) => {
    const violations = evaluatePosition(pos, policy, positions, vaults);
    return {
      ...pos,
      severity: getSeverity(violations),
      violations,
    };
  });
}

/**
 * Check if depositing `amount` into a vault would violate concentration post-move.
 * Also checks if the resulting idle cash ratio is maintained.
 */
export function wouldViolateConcentration(
  vault: Vault,
  depositAmountUsd: number,
  existingPositions: Position[],
  policy: Policy
): { ok: boolean; message?: string } {
  const totalValue = existingPositions.reduce((s, p) => s + p.balanceUsd, 0) + depositAmountUsd;
  if (totalValue <= 0) return { ok: true };

  // Skip concentration check for very small portfolios (< $100)
  // Diversification rules don't make practical sense at this scale
  if (totalValue < 100) return { ok: true };

  // Check protocol concentration after deposit
  const protocolValueAfter =
    existingPositions
      .filter((p) => p.protocolName.toLowerCase() === vault.protocolName.toLowerCase())
      .reduce((s, p) => s + p.balanceUsd, 0) + depositAmountUsd;

  const concentrationAfter = (protocolValueAfter / totalValue) * 100;
  if (concentrationAfter > policy.maxProtocolExposurePct) {
    return {
      ok: false,
      message: `Deposit would push ${vault.protocolName} exposure to ${concentrationAfter.toFixed(1)}% (max ${policy.maxProtocolExposurePct}%).`,
    };
  }

  return { ok: true };
}

/**
 * Check if the portfolio maintains minimum idle cash after a deposit.
 */
export function checkIdleCash(
  depositAmountUsd: number,
  walletUsdcBalanceUsd: number,
  policy: Policy,
  existingPositions: Position[]
): { ok: boolean; message?: string } {
  const totalDeployed = existingPositions.reduce((s, p) => s + p.balanceUsd, 0) + depositAmountUsd;
  const remainingCash = walletUsdcBalanceUsd - depositAmountUsd;
  const totalValue = totalDeployed + remainingCash;

  if (totalValue <= 0) return { ok: true };

  // Skip idle cash check for very small portfolios (< $100)
  if (totalValue < 100) return { ok: true };

  const idlePct = (remainingCash / totalValue) * 100;
  if (idlePct < policy.minIdleCashPct) {
    return {
      ok: false,
      message: `Deposit would reduce idle cash to ${idlePct.toFixed(1)}% (min ${policy.minIdleCashPct}%).`,
    };
  }

  return { ok: true };
}

/**
 * Find the best compliant vault for a repair/deposit.
 * Now accounts for post-deposit concentration.
 */
export function findBestCompliantVault(
  policy: Policy,
  vaults: Vault[],
  existingPositions?: Position[],
  depositAmountUsd?: number
): Vault | null {
  const candidates = vaults.filter((v) => {
    if (!v.isTransactional) return false;
    if (!policy.allowedChainIds.includes(v.chainId)) return false;
    if (
      policy.allowedProtocols.length > 0 &&
      !policy.allowedProtocols
        .map((p) => p.toLowerCase())
        .includes(v.protocolName.toLowerCase())
    ) {
      return false;
    }
    if (v.tvlUsd < policy.minTvlUsd) return false;
    if (v.apyTotal === null) return false;
    if (v.apyTotal < policy.minApy) return false;
    if (v.underlyingSymbol.toUpperCase() !== "USDC") return false;

    // Check post-deposit concentration if we have the data
    if (existingPositions && depositAmountUsd && depositAmountUsd > 0) {
      const check = wouldViolateConcentration(v, depositAmountUsd, existingPositions, policy);
      if (!check.ok) return false;
    }

    return true;
  });

  if (candidates.length === 0) return null;

  // Sort: highest APY first, then highest TVL as tie-breaker
  candidates.sort((a, b) => {
    const apyDiff = (b.apyTotal ?? 0) - (a.apyTotal ?? 0);
    if (Math.abs(apyDiff) > 0.01) return apyDiff;
    return b.tvlUsd - a.tvlUsd;
  });

  return candidates[0];
}

/**
 * Get all compliant vaults ranked.
 */
export function getCompliantVaults(
  policy: Policy,
  vaults: Vault[]
): Vault[] {
  return vaults
    .filter((v) => {
      if (!v.isTransactional) return false;
      if (!policy.allowedChainIds.includes(v.chainId)) return false;
      if (
        policy.allowedProtocols.length > 0 &&
        !policy.allowedProtocols
          .map((p) => p.toLowerCase())
          .includes(v.protocolName.toLowerCase())
      ) {
        return false;
      }
      if (v.tvlUsd < policy.minTvlUsd) return false;
      if (v.apyTotal !== null && v.apyTotal < policy.minApy) return false;
      if (v.underlyingSymbol.toUpperCase() !== "USDC") return false;
      return true;
    })
    .sort((a, b) => {
      const apyDiff = (b.apyTotal ?? 0) - (a.apyTotal ?? 0);
      if (Math.abs(apyDiff) > 0.01) return apyDiff;
      return b.tvlUsd - a.tvlUsd;
    });
}

function formatNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

// ============================================================
// Repair Simulation — True source→target move delta
// ============================================================

export interface PortfolioSnapshot {
  totalValueUsd: number;
  violationCount: number;
  warningCount: number;
  compliantCount: number;
  /** Top protocol exposures: { protocol: "Aave V3", pct: 42.1 } */
  protocolExposures: { protocol: string; pct: number }[];
  /** Chain distribution: { chain: "Ethereum", pct: 60 } */
  chainMix: { chainId: number; pct: number }[];
  /** Health score 0-100: 100 = all compliant, penalized by violations */
  healthScore: number;
}

/**
 * Compute a portfolio snapshot from positions.
 */
export function computePortfolioSnapshot(
  positions: Position[],
  policy: Policy,
  vaults: Vault[]
): PortfolioSnapshot {
  const evaluated = evaluatePortfolio(positions, policy, vaults);
  const totalValueUsd = positions.reduce((s, p) => s + p.balanceUsd, 0);

  const violationCount = evaluated.filter((p) => p.severity === "violating").length;
  const warningCount = evaluated.filter((p) => p.severity === "warning").length;
  const compliantCount = evaluated.filter((p) => p.severity === "compliant").length;

  // Protocol exposures
  const protoMap = new Map<string, number>();
  for (const p of positions) {
    protoMap.set(p.protocolName, (protoMap.get(p.protocolName) || 0) + p.balanceUsd);
  }
  const protocolExposures = [...protoMap.entries()]
    .map(([protocol, value]) => ({
      protocol,
      pct: totalValueUsd > 0 ? (value / totalValueUsd) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  // Chain mix
  const chainMap = new Map<number, number>();
  for (const p of positions) {
    chainMap.set(p.chainId, (chainMap.get(p.chainId) || 0) + p.balanceUsd);
  }
  const chainMix = [...chainMap.entries()]
    .map(([chainId, value]) => ({
      chainId,
      pct: totalValueUsd > 0 ? (value / totalValueUsd) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  // Health score: 100 base, -25 per violation, -10 per warning
  const healthScore = Math.max(0, Math.min(100,
    100 - violationCount * 25 - warningCount * 10
  ));

  return {
    totalValueUsd, violationCount, warningCount, compliantCount,
    protocolExposures, chainMix, healthScore,
  };
}

/**
 * Simulate a repair: subtract value from source, add to target vault.
 * Returns before and after snapshots.
 */
export function simulateRepair(
  sourcePosition: Position,
  targetVault: Vault,
  moveAmountUsd: number,
  allPositions: Position[],
  policy: Policy,
  vaults: Vault[]
): { before: PortfolioSnapshot; after: PortfolioSnapshot } {
  const before = computePortfolioSnapshot(allPositions, policy, vaults);

  // Build the "after" positions: subtract from source, add to target
  const afterPositions: Position[] = allPositions.map((p) => {
    if (
      p.vaultAddress.toLowerCase() === sourcePosition.vaultAddress.toLowerCase() &&
      p.chainId === sourcePosition.chainId
    ) {
      const remainingUsd = Math.max(0, p.balanceUsd - moveAmountUsd);
      return remainingUsd > 0
        ? { ...p, balanceUsd: remainingUsd, balanceNative: String(remainingUsd) }
        : null!; // fully drained
    }
    return p;
  }).filter(Boolean);

  // Add new position in the target vault
  afterPositions.push({
    chainId: targetVault.chainId,
    protocolName: targetVault.protocolName,
    vaultAddress: targetVault.address,
    assetAddress: targetVault.address,
    assetSymbol: targetVault.underlyingSymbol,
    assetDecimals: 6,
    balanceUsd: moveAmountUsd,
    balanceNative: String(moveAmountUsd),
    balanceAtomic: null,
  });

  const after = computePortfolioSnapshot(afterPositions, policy, vaults);

  return { before, after };
}

/**
 * Generate a "Why this vault?" checklist for a target vault.
 */
export function explainVaultCompliance(
  vault: Vault,
  policy: Policy,
  positions: Position[],
  moveAmountUsd: number
): { label: string; passes: boolean }[] {
  const checks: { label: string; passes: boolean }[] = [];

  const chainOk = policy.allowedChainIds.includes(vault.chainId);
  checks.push({ label: "Chain is allowed by policy", passes: chainOk });

  const protoOk =
    policy.allowedProtocols.length === 0 ||
    policy.allowedProtocols
      .map((p) => p.toLowerCase())
      .includes(vault.protocolName.toLowerCase());
  checks.push({ label: "Protocol is allowed by policy", passes: protoOk });

  checks.push({
    label: `TVL ($${formatNum(vault.tvlUsd)}) ≥ minimum ($${formatNum(policy.minTvlUsd)})`,
    passes: vault.tvlUsd >= policy.minTvlUsd,
  });

  const apyOk = vault.apyTotal !== null && vault.apyTotal >= policy.minApy;
  checks.push({
    label: `APY (${vault.apyTotal?.toFixed(2) ?? "N/A"}%) ≥ minimum (${policy.minApy}%)`,
    passes: apyOk,
  });

  // Post-move concentration check
  const concCheck = wouldViolateConcentration(vault, moveAmountUsd, positions, policy);
  checks.push({
    label: `Post-move concentration safe (≤${policy.maxProtocolExposurePct}%)`,
    passes: concCheck.ok,
  });

  return checks;
}
