"use client";

import { useMemo } from "react";
import { PositionWithStatus, Vault, Policy, CHAIN_NAMES, CHAIN_ICONS } from "@/types";
import { formatUsd, formatCompact, shortenAddress } from "@/lib/utils";
import { findBestCompliantVault } from "@/lib/policy-engine";

export function Portfolio({
  positions,
  vaults,
  policy,
  loading,
  onRepairClick,
  onRefresh,
}: {
  positions: PositionWithStatus[];
  vaults: Vault[];
  policy: Policy;
  loading: boolean;
  onRepairClick: (position: PositionWithStatus, targetVault: Vault) => void;
  onRefresh: () => void;
}) {
  const compliant = positions.filter((p) => p.severity === "compliant");
  const warnings = positions.filter((p) => p.severity === "warning");
  const violations = positions.filter((p) => p.severity === "violating");
  const totalValue = positions.reduce((s, p) => s + p.balanceUsd, 0);

  // Per-position vault recommendations, accounting for post-move concentration
  const positionVaults = useMemo(() => {
    const map = new Map<string, Vault | null>();
    for (const pos of positions) {
      if (pos.severity === "compliant") continue;
      const key = `${pos.chainId}-${pos.vaultAddress}`;
      const best = findBestCompliantVault(policy, vaults, positions, pos.balanceUsd);
      map.set(key, best);
    }
    return map;
  }, [positions, vaults, policy]);

  function getVaultForPosition(pos: PositionWithStatus): Vault | null {
    const key = `${pos.chainId}-${pos.vaultAddress}`;
    return positionVaults.get(key) ?? null;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 16 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <div style={{ color: "var(--text-secondary)" }}>Loading positions...</div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="card animate-fade-in" style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No positions found</div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 400, margin: "0 auto", marginBottom: 20 }}>
          Connect your wallet and ensure you have active LI.FI Earn positions to see policy violations.
        </p>
        <button className="btn btn-primary" onClick={onRefresh}>
          Refresh Positions
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary bar */}
      <div className="card" style={{ padding: 20, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>Total Value</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatUsd(totalValue)}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span className="badge badge-compliant">✓ {compliant.length} Compliant</span>
          <span className="badge badge-warning">⚠ {warnings.length} Warning</span>
          <span className="badge badge-violating">✗ {violations.length} Violating</span>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={onRefresh}>
          ↻ Refresh
        </button>
      </div>

      {/* Violations first */}
      {violations.length > 0 && (
        <Section title="🚨 Violations" subtitle="These positions break policy rules and should be repaired">
          {violations.map((pos, i) => (
            <PositionCard
              key={i}
              position={pos}
              bestVault={getVaultForPosition(pos)}
              onRepair={(vault) => onRepairClick(pos, vault)}
            />
          ))}
        </Section>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Section title="⚠ Warnings" subtitle="These positions are near policy thresholds">
          {warnings.map((pos, i) => (
            <PositionCard
              key={i}
              position={pos}
              bestVault={getVaultForPosition(pos)}
              onRepair={(vault) => onRepairClick(pos, vault)}
            />
          ))}
        </Section>
      )}

      {/* Compliant */}
      {compliant.length > 0 && (
        <Section title="✓ Compliant" subtitle="These positions meet all policy requirements">
          {compliant.map((pos, i) => (
            <PositionCard key={i} position={pos} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function PositionCard({
  position,
  bestVault,
  onRepair,
}: {
  position: PositionWithStatus;
  bestVault?: Vault | null;
  onRepair?: (vault: Vault) => void;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Severity line */}
      <div
        className={`severity-line severity-line-${position.severity}`}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, paddingLeft: 12 }}>
        {/* Chain icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--bg-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
            border: "1px solid var(--border-subtle)",
          }}
        >
          {CHAIN_ICONS[position.chainId] || "⟐"}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{position.protocolName}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {CHAIN_NAMES[position.chainId]} • {position.assetSymbol}
            </span>
            <span className={`badge badge-${position.severity}`}>
              {position.severity}
            </span>
          </div>

          {/* Value */}
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {formatUsd(position.balanceUsd)}
          </div>

          {/* Violations */}
          {position.violations.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {position.violations.map((v, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 13,
                    color: v.severity === "violating" ? "var(--violating)" : "var(--warning)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{v.severity === "violating" ? "✗" : "⚠"}</span>
                  {v.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vault address + Repair button */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            {shortenAddress(position.vaultAddress)}
          </div>
          {position.severity !== "compliant" && bestVault && onRepair && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onRepair(bestVault)}
            >
              {bestVault.chainId !== position.chainId ? "⛓ Cross-Chain Repair →" : "Repair →"}
            </button>
          )}
          {position.severity !== "compliant" && !bestVault && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No compliant vault</span>
          )}
        </div>
      </div>

      {/* Recommended target */}
      {position.severity !== "compliant" && bestVault && (
        <div
          style={{
            marginTop: 12,
            marginLeft: 68,
            padding: 12,
            background: "var(--bg-primary)",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Recommended target: </span>
          <span style={{ fontWeight: 600 }}>{bestVault.name}</span>
          <span style={{ color: "var(--text-muted)" }}> on {CHAIN_NAMES[bestVault.chainId]}</span>
          {bestVault.chainId !== position.chainId && (
            <span style={{ color: "rgba(139,92,246,0.9)", marginLeft: 8, fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "rgba(139,92,246,0.12)" }}>
              ⛓ Cross-chain
            </span>
          )}
          <span style={{ color: "var(--compliant)", marginLeft: 8 }}>
            {bestVault.apyTotal !== null ? `${bestVault.apyTotal.toFixed(2)}%` : "N/A"} APY
          </span>
          <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
            TVL {formatCompact(bestVault.tvlUsd)}
          </span>
        </div>
      )}
    </div>
  );
}
