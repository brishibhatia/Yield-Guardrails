"use client";

import { useState, useMemo } from "react";
import { Vault, Policy, CHAIN_NAMES, CHAIN_ICONS, SUPPORTED_CHAIN_IDS } from "@/types";
import { formatCompact, formatApy } from "@/lib/utils";
import type { LifiChain } from "@/lib/lifi-client";

/** APY trend badge: compare total vs 7d or 30d */
function trendBadge(vault: Vault): { label: string; color: string } | null {
  const total = vault.apyTotal;
  const ref = vault.apy7d ?? vault.apy30d ?? null;
  if (total === null || ref === null) return null;
  const diff = total - ref;
  const pct = ref > 0 ? (diff / ref) * 100 : 0;
  if (pct > 5) return { label: "▲ Improving", color: "var(--compliant)" };
  if (pct < -5) return { label: "▼ Declining", color: "var(--violating)" };
  return { label: "— Stable", color: "var(--text-muted)" };
}

export function VaultExplorer({
  vaults,
  loading,
  policy,
  onDepositClick,
  lifiChainCount,
  lifiProtocolCount,
  liveChains,
}: {
  vaults: Vault[];
  loading: boolean;
  policy: Policy;
  onDepositClick: (vault: Vault) => void;
  lifiChainCount?: number;
  lifiProtocolCount?: number;
  liveChains?: LifiChain[];
}) {
  const [chainFilter, setChainFilter] = useState<number | "all">("all");
  const [protocolFilter, setProtocolFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"policy-rank" | "apy" | "tvl">("policy-rank");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyCompliant, setShowOnlyCompliant] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());

  const protocols = useMemo(() => {
    const set = new Set(vaults.map((v) => v.protocolName));
    return Array.from(set).sort();
  }, [vaults]);

  const filteredVaults = useMemo(() => {
    let result = vaults.filter((v) => v.underlyingSymbol.toUpperCase() === "USDC");

    if (chainFilter !== "all") {
      result = result.filter((v) => v.chainId === chainFilter);
    }
    if (protocolFilter !== "all") {
      result = result.filter((v) => v.protocolName.toLowerCase() === protocolFilter.toLowerCase());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.protocolName.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q)
      );
    }
    if (showOnlyCompliant) {
      result = result.filter((v) => checkVaultCompliance(v, policy));
    }

    // Deterministic ranking: policy-pass first → higher APY → better stability → higher TVL
    if (sortBy === "policy-rank") {
      result.sort((a, b) => {
        const aCompliant = checkVaultCompliance(a, policy) ? 1 : 0;
        const bCompliant = checkVaultCompliance(b, policy) ? 1 : 0;
        if (bCompliant !== aCompliant) return bCompliant - aCompliant;
        // Transactional before non-transactional
        const aTx = a.isTransactional ? 1 : 0;
        const bTx = b.isTransactional ? 1 : 0;
        if (bTx !== aTx) return bTx - aTx;
        const apyDiff = (b.apyTotal ?? -1) - (a.apyTotal ?? -1);
        if (Math.abs(apyDiff) > 0.1) return apyDiff;
        // APY stability: lower variance = better
        const aStab = apyStability(a);
        const bStab = apyStability(b);
        if (aStab !== bStab) return aStab - bStab;
        return b.tvlUsd - a.tvlUsd;
      });
    } else if (sortBy === "apy") {
      result.sort((a, b) => (b.apyTotal ?? -1) - (a.apyTotal ?? -1));
    } else {
      result.sort((a, b) => b.tvlUsd - a.tvlUsd);
    }

    return result;
  }, [vaults, chainFilter, protocolFilter, sortBy, searchQuery, showOnlyCompliant, policy]);

  // Compare panel vaults
  const comparedVaults = useMemo(() => {
    return filteredVaults.filter((v) => compareSet.has(vaultKey(v)));
  }, [filteredVaults, compareSet]);

  const toggleCompare = (vault: Vault) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      const key = vaultKey(vault);
      if (next.has(key)) next.delete(key);
      else if (next.size < 4) next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 16 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <div style={{ color: "var(--text-secondary)" }}>Loading vaults from LI.FI Earn...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* LI.FI Coverage Strip */}
      {(lifiChainCount || lifiProtocolCount) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, padding: "10px 20px",
          background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))",
          borderRadius: 10, border: "1px solid rgba(139,92,246,0.15)",
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(167,139,250,0.9)" }}>
            Powered by LI.FI Earn
          </span>
          {lifiChainCount && lifiChainCount > 0 && (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{lifiChainCount}</strong> chains
            </span>
          )}
          {lifiProtocolCount && lifiProtocolCount > 0 && (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{lifiProtocolCount}</strong> protocols
            </span>
          )}
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>{vaults.length}</strong> vaults loaded
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Search vaults..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={chainFilter === "all" ? "all" : String(chainFilter)}
          onChange={(e) => setChainFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">All Chains</option>
          {(liveChains && liveChains.length > 0
            ? liveChains.map(c => ({ id: c.id, name: c.name }))
            : SUPPORTED_CHAIN_IDS.map(id => ({ id, name: CHAIN_NAMES[id] || `Chain ${id}` }))
          ).map(({ id, name }) => (
            <option key={id} value={id}>{CHAIN_ICONS[id] || "⟐"} {name}</option>
          ))}
        </select>

        <select
          className="input"
          style={{ maxWidth: 180 }}
          value={protocolFilter}
          onChange={(e) => setProtocolFilter(e.target.value)}
        >
          <option value="all">All Protocols</option>
          {protocols.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <div className="tab-nav">
          <button
            className={`tab-btn ${sortBy === "policy-rank" ? "tab-btn-active" : ""}`}
            onClick={() => setSortBy("policy-rank")}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            Policy Rank
          </button>
          <button
            className={`tab-btn ${sortBy === "apy" ? "tab-btn-active" : ""}`}
            onClick={() => setSortBy("apy")}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            APY
          </button>
          <button
            className={`tab-btn ${sortBy === "tvl" ? "tab-btn-active" : ""}`}
            onClick={() => setSortBy("tvl")}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            TVL
          </button>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showOnlyCompliant}
            onChange={(e) => setShowOnlyCompliant(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Policy only
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => { setCompareMode(e.target.checked); if (!e.target.checked) setCompareSet(new Set()); }}
            style={{ accentColor: "var(--accent)" }}
          />
          Compare
        </label>

        <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>
          {filteredVaults.length} vault{filteredVaults.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Compare Panel */}
      {compareMode && comparedVaults.length > 0 && (
        <ComparePanel vaults={comparedVaults} policy={policy} onDeposit={onDepositClick} onRemove={(v) => toggleCompare(v)} />
      )}

      {/* Vault List */}
      {filteredVaults.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⬡</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No vaults found</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Try adjusting your filters or policy settings
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredVaults.map((vault) => (
            <VaultRow
              key={`${vault.chainId}-${vault.address}`}
              vault={vault}
              policy={policy}
              onDeposit={() => onDepositClick(vault)}
              compareMode={compareMode}
              isCompared={compareSet.has(vaultKey(vault))}
              onToggleCompare={() => toggleCompare(vault)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VaultRow({
  vault,
  policy,
  onDeposit,
  compareMode,
  isCompared,
  onToggleCompare,
}: {
  vault: Vault;
  policy: Policy;
  onDeposit: () => void;
  compareMode: boolean;
  isCompared: boolean;
  onToggleCompare: () => void;
}) {
  const isCompliant = checkVaultCompliance(vault, policy);
  const trend = trendBadge(vault);

  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        border: isCompared ? "1px solid rgba(139,92,246,0.4)" : undefined,
      }}
    >
      {/* Compliance indicator */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: isCompliant ? "var(--compliant)" : "var(--violating)",
          borderRadius: "3px 0 0 3px",
        }}
      />

      {/* Compare checkbox */}
      {compareMode && (
        <input
          type="checkbox"
          checked={isCompared}
          onChange={(e) => { e.stopPropagation(); onToggleCompare(); }}
          style={{ accentColor: "var(--accent)", flexShrink: 0 }}
        />
      )}

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
        {CHAIN_ICONS[vault.chainId] || "⟐"}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {vault.name}
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-secondary)", flexWrap: "wrap", alignItems: "center" }}>
          <span>{CHAIN_NAMES[vault.chainId]}</span>
          <span>•</span>
          <span>{vault.protocolName}</span>
          {vault.isTransactional ? (
            <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "rgba(16,185,129,0.12)", color: "rgba(16,185,129,0.95)", fontWeight: 600 }}>
              Depositable
            </span>
          ) : (
            <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.8)", fontWeight: 600 }}>
              View only
            </span>
          )}
          {vault.tags.length > 0 && vault.tags.slice(0, 2).map(t => (
            <span key={t} style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3, background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* APY with trend */}
      <div style={{ textAlign: "right", minWidth: 90 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: vault.apyTotal !== null && vault.apyTotal > 0 ? "var(--compliant)" : "var(--text-muted)" }}>
          {formatApy(vault.apyTotal)}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>APY</div>
        {trend && (
          <div style={{ fontSize: 10, color: trend.color, marginTop: 2 }}>{trend.label}</div>
        )}
      </div>

      {/* Base/Reward/1d APY breakdown */}
      {(vault.apyBase !== null || vault.apyReward !== null || vault.apy1d !== null) && (
        <div style={{ textAlign: "right", minWidth: 70 }}>
          {vault.apyBase !== null && (
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Base {vault.apyBase.toFixed(2)}%
            </div>
          )}
          {vault.apyReward !== null && vault.apyReward > 0 && (
            <div style={{ fontSize: 11, color: "rgba(139,92,246,0.8)" }}>
              Reward {vault.apyReward.toFixed(2)}%
            </div>
          )}
          {vault.apy1d !== null && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              1d {vault.apy1d.toFixed(2)}%
            </div>
          )}
        </div>
      )}

      {/* TVL */}
      <div style={{ textAlign: "right", minWidth: 80 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCompact(vault.tvlUsd)}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>TVL</div>
      </div>

      {/* Compliance badge */}
      <div className={`badge ${isCompliant ? "badge-compliant" : "badge-violating"}`}>
        {isCompliant ? "✓ Policy" : "✗ Policy"}
      </div>

      {/* Deposit button */}
      {vault.isTransactional ? (
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDeposit();
          }}
        >
          Deposit
        </button>
      ) : (
        <button
          className="btn btn-ghost btn-sm"
          disabled
          title="This vault is not depositable via LI.FI"
          style={{ opacity: 0.5, cursor: "not-allowed" }}
        >
          No deposit
        </button>
      )}
    </div>
  );
}

/** Side-by-side comparison panel */
function ComparePanel({
  vaults,
  policy,
  onDeposit,
  onRemove,
}: {
  vaults: Vault[];
  policy: Policy;
  onDeposit: (v: Vault) => void;
  onRemove: (v: Vault) => void;
}) {
  return (
    <div className="card" style={{ padding: 20, overflow: "auto" }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
        🔍 Compare Vaults ({vaults.length})
      </div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vault</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Total APY</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Base</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Reward</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>1d</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>7d</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>30d</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>TVL</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "center" }}>Tags</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "center" }}>Trend</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "center" }}>Status</th>
            <th style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "center" }}>Policy</th>
            <th style={{ padding: "8px 10px" }}></th>
          </tr>
        </thead>
        <tbody>
          {vaults.map((v) => {
            const isCompliant = checkVaultCompliance(v, policy);
            const trend = trendBadge(v);
            return (
              <tr key={vaultKey(v)} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "10px 10px" }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{CHAIN_ICONS[v.chainId]} {CHAIN_NAMES[v.chainId]} • {v.protocolName}</div>
                </td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "var(--compliant)" }}>{formatApy(v.apyTotal)}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{v.apyBase !== null ? `${v.apyBase.toFixed(2)}%` : "—"}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", color: "rgba(139,92,246,0.8)" }}>{v.apyReward !== null && v.apyReward > 0 ? `${v.apyReward.toFixed(2)}%` : "—"}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{v.apy1d !== null ? `${v.apy1d.toFixed(2)}%` : "—"}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{v.apy7d !== null ? `${v.apy7d.toFixed(2)}%` : "—"}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--text-secondary)" }}>{v.apy30d !== null ? `${v.apy30d.toFixed(2)}%` : "—"}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{formatCompact(v.tvlUsd)}</td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>
                  {v.tags.length > 0 ? v.tags.slice(0, 2).map(t => (
                    <span key={t} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)", marginRight: 2, display: "inline-block" }}>{t}</span>
                  )) : "—"}
                </td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>{trend ? <span style={{ fontSize: 11, color: trend.color }}>{trend.label}</span> : "—"}</td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>
                  {v.isTransactional ? (
                    <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(16,185,129,0.12)", color: "rgba(16,185,129,0.95)", fontWeight: 600 }}>Depositable</span>
                  ) : (
                    <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.8)", fontWeight: 600 }}>View only</span>
                  )}
                </td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>
                  <span className={`badge ${isCompliant ? "badge-compliant" : "badge-violating"}`} style={{ fontSize: 11 }}>
                    {isCompliant ? "✓" : "✗"}
                  </span>
                </td>
                <td style={{ padding: "10px 10px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {v.isTransactional && (
                      <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => onDeposit(v)}>
                        Deposit
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => onRemove(v)}>
                      ×
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function checkVaultCompliance(vault: Vault, policy: Policy): boolean {
  if (!policy.allowedChainIds.includes(vault.chainId)) return false;
  if (
    policy.allowedProtocols.length > 0 &&
    !policy.allowedProtocols.map((p) => p.toLowerCase()).includes(vault.protocolName.toLowerCase())
  )
    return false;
  if (vault.tvlUsd < policy.minTvlUsd) return false;
  if (vault.apyTotal !== null && vault.apyTotal < policy.minApy) return false;
  return true;
}

function vaultKey(v: Vault): string {
  return `${v.chainId}-${v.address}`;
}

/** Lower = more stable */
function apyStability(v: Vault): number {
  const vals = [v.apyTotal, v.apy1d, v.apy7d, v.apy30d].filter((x): x is number => x !== null);
  if (vals.length < 2) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((s, x) => s + (x - avg) ** 2, 0) / vals.length;
  return variance;
}
