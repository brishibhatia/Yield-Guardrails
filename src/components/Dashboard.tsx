"use client";

import { PositionWithStatus, Policy, Vault } from "@/types";
import { CHAIN_NAMES, CHAIN_ICONS } from "@/types";
import { formatUsd, formatCompact } from "@/lib/utils";
import { getCompliantVaults } from "@/lib/policy-engine";

export function Dashboard({
  positions,
  policy,
  vaults,
  onNavigate,
  lifiChainCount,
  lifiProtocolCount,
}: {
  positions: PositionWithStatus[];
  policy: Policy;
  vaults: Vault[];
  onNavigate: (tab: string) => void;
  lifiChainCount?: number;
  lifiProtocolCount?: number;
}) {
  const totalValue = positions.reduce((s, p) => s + p.balanceUsd, 0);
  const compliant = positions.filter((p) => p.severity === "compliant").length;
  const warnings = positions.filter((p) => p.severity === "warning").length;
  const violations = positions.filter((p) => p.severity === "violating").length;

  // Top policy-passing vaults (no amount context — just rule-passing)
  const topVaults = getCompliantVaults(policy, vaults).slice(0, 3);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <StatCard
          label="Total Treasury Value"
          value={totalValue > 0 ? formatUsd(totalValue) : "—"}
          sublabel={positions.length > 0 ? `${positions.length} position${positions.length > 1 ? 's' : ''}` : "Connect wallet to load"}
          variant="accent"
        />
        <StatCard
          label="Compliant"
          value={String(compliant)}
          sublabel={compliant > 0 ? "Positions passing all rules" : "No compliant positions"}
          variant="compliant"
        />
        <StatCard
          label="Warnings"
          value={String(warnings)}
          sublabel={warnings > 0 ? "Near policy thresholds" : "No warnings"}
          variant="warning"
        />
        <StatCard
          label="Violations"
          value={String(violations)}
          sublabel={violations > 0 ? "Breaking policy rules" : "No violations"}
          variant="violating"
        />
      </div>

      {/* LI.FI Coverage Strip */}
      {(lifiChainCount || lifiProtocolCount) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 20, padding: "14px 20px",
          background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.1))",
          borderRadius: 10, border: "1px solid rgba(139,92,246,0.2)",
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(167,139,250,0.9)" }}>
            Powered by LI.FI Earn
          </span>
          <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-secondary)" }}>
            {lifiChainCount && lifiChainCount > 0 && (
              <span><strong style={{ color: "var(--text-primary)", fontSize: 16, marginRight: 4 }}>{lifiChainCount}</strong>chains</span>
            )}
            {lifiProtocolCount && lifiProtocolCount > 0 && (
              <span><strong style={{ color: "var(--text-primary)", fontSize: 16, marginRight: 4 }}>{lifiProtocolCount}</strong>protocols</span>
            )}
            <span><strong style={{ color: "var(--text-primary)", fontSize: 16, marginRight: 4 }}>{vaults.filter(v => v.isTransactional).length}</strong>depositable vaults</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("vaults")} style={{ marginLeft: "auto", fontSize: 12 }}>
            Explore →
          </button>
        </div>
      )}

      {/* Policy Summary */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Policy Summary</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {policy.name} • {policy.assetSymbol}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("policy")}>
            Edit Policy →
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <PolicyItem label="Allowed Chains" value={policy.allowedChainIds.map(id => CHAIN_NAMES[id] || String(id)).join(", ")} />
          <PolicyItem label="Allowed Protocols" value={policy.allowedProtocols.length > 0 ? policy.allowedProtocols.join(", ") : "All"} />
          <PolicyItem label="Min TVL" value={formatCompact(policy.minTvlUsd)} />
          <PolicyItem label="Min APY" value={`${policy.minApy}%`} />
          <PolicyItem label="Max Protocol Exposure" value={`${policy.maxProtocolExposurePct}%`} />
          <PolicyItem label="Min Idle Cash" value={`${policy.minIdleCashPct}%`} />
        </div>
      </div>

      {/* Top Vaults + CTA */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {topVaults.length > 0 && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              ★ Top Policy-Pass Vaults
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
              These vaults meet all policy rules. Concentration limits are checked at deposit time.
            </div>
            {topVaults.map((v, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: i < topVaults.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {CHAIN_ICONS[v.chainId]} {CHAIN_NAMES[v.chainId]} • {v.protocolName}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--compliant)" }}>
                    {v.apyTotal !== null ? `${v.apyTotal.toFixed(2)}%` : "N/A"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>TVL {formatCompact(v.tvlUsd)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          className="card"
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            gridColumn: topVaults.length > 0 ? "auto" : "1 / -1",
          }}
        >
          {violations > 0 ? (
            <>
              <div style={{ fontSize: 32 }}>🛡️</div>
              <div style={{ fontSize: 16, fontWeight: 600, textAlign: "center" }}>
                {violations} violation{violations > 1 ? "s" : ""} detected
              </div>
              <button
                className="btn btn-danger btn-lg animate-pulse-glow"
                onClick={() => onNavigate("portfolio")}
              >
                Repair Portfolio
              </button>
            </>
          ) : positions.length > 0 ? (
            <>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--compliant)" }}>
                All positions are compliant
              </div>
              <button className="btn btn-primary" onClick={() => onNavigate("vaults")}>
                Explore Vaults →
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32 }}>🏦</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Ready to Start</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
                Connect your wallet and set your policy to begin
              </p>
              <button className="btn btn-primary" onClick={() => onNavigate("vaults")}>
                Explore Vaults →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  variant,
}: {
  label: string;
  value: string;
  sublabel: string;
  variant: "accent" | "compliant" | "warning" | "violating";
}) {
  const colors: Record<string, string> = {
    accent: "var(--accent)",
    compliant: "var(--compliant)",
    warning: "var(--warning)",
    violating: "var(--violating)",
  };

  return (
    <div className="card stat-glow" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: colors[variant], letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
        {sublabel}
      </div>
    </div>
  );
}

function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
