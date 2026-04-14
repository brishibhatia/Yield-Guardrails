"use client";

import { useState, useEffect, useCallback } from "react";
import { Policy, CHAIN_NAMES, CHAIN_ICONS, SUPPORTED_CHAIN_IDS } from "@/types";
import { loadPolicy, savePolicy } from "@/lib/store";
import { fetchTools, ToolInfo } from "@/lib/lifi-client";
import type { LifiChain } from "@/lib/lifi-client";

export function PolicyBuilder({
  onPolicyChange,
  availableProtocols,
  liveChains,
}: {
  onPolicyChange: (policy: Policy) => void;
  availableProtocols: string[];
  liveChains?: LifiChain[];
}) {
  const [policy, setPolicy] = useState<Policy>(() => loadPolicy());
  const [saved, setSaved] = useState(false);
  const [newProtocol, setNewProtocol] = useState("");
  const [showRouteSettings, setShowRouteSettings] = useState(false);

  // Tools data from /api/tools
  const [bridges, setBridges] = useState<ToolInfo[]>([]);
  const [exchanges, setExchanges] = useState<ToolInfo[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  // Derive chain options: live chains if available, fallback to SUPPORTED_CHAIN_IDS
  const chainOptions: { id: number; name: string }[] = liveChains && liveChains.length > 0
    ? liveChains.map(c => ({ id: c.id, name: c.name }))
    : SUPPORTED_CHAIN_IDS.map(id => ({ id, name: CHAIN_NAMES[id] || `Chain ${id}` }));

  useEffect(() => {
    onPolicyChange(policy);
  }, [policy, onPolicyChange]);

  // Fetch tools when route settings are opened
  const loadTools = useCallback(async () => {
    if (bridges.length > 0 || toolsLoading) return;
    setToolsLoading(true);
    try {
      const tools = await fetchTools();
      setBridges(tools.bridges || []);
      setExchanges(tools.exchanges || []);
    } catch (err) {
      console.error("Failed to load tools:", err);
    } finally {
      setToolsLoading(false);
    }
  }, [bridges.length, toolsLoading]);

  useEffect(() => {
    if (showRouteSettings) loadTools();
  }, [showRouteSettings, loadTools]);

  const handleSave = () => {
    savePolicy(policy);
    onPolicyChange(policy);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleChain = (chainId: number) => {
    setPolicy((prev) => ({
      ...prev,
      allowedChainIds: prev.allowedChainIds.includes(chainId)
        ? prev.allowedChainIds.filter((id) => id !== chainId)
        : [...prev.allowedChainIds, chainId],
    }));
  };

  const addProtocol = (protocol: string) => {
    if (!protocol.trim()) return;
    if (policy.allowedProtocols.map(p => p.toLowerCase()).includes(protocol.toLowerCase())) return;
    setPolicy((prev) => ({
      ...prev,
      allowedProtocols: [...prev.allowedProtocols, protocol.trim()],
    }));
    setNewProtocol("");
  };

  const removeProtocol = (protocol: string) => {
    setPolicy((prev) => ({
      ...prev,
      allowedProtocols: prev.allowedProtocols.filter((p) => p !== protocol),
    }));
  };

  // Route preference helpers
  const updateRoutePrefs = (partial: Partial<Policy["routePreferences"]>) => {
    setPolicy((prev) => ({
      ...prev,
      routePreferences: { ...prev.routePreferences, ...partial },
    }));
  };

  const toggleListItem = (field: "allowBridges" | "preferredBridges" | "allowExchanges" | "preferredExchanges", key: string) => {
    setPolicy((prev) => {
      const current = prev.routePreferences[field];
      const next = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key];
      return { ...prev, routePreferences: { ...prev.routePreferences, [field]: next } };
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Treasury Policy</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Define rules to govern your USDC treasury allocations. Positions violating these rules will be flagged.
        </p>
      </div>

      {/* Policy Name */}
      <div className="card" style={{ padding: 24 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>
          Policy Name
        </label>
        <input
          className="input"
          value={policy.name}
          onChange={(e) => setPolicy((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="My Treasury Policy"
        />
      </div>

      {/* Allowed Chains — uses live chain data when available */}
      <div className="card" style={{ padding: 24 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "block" }}>
          Allowed Chains
          {liveChains && liveChains.length > 0 && (
            <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 8, color: "rgba(139,92,246,0.7)", fontSize: 11 }}>
              {liveChains.length} chains from LI.FI
            </span>
          )}
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {chainOptions.map(({ id, name }) => {
            const active = policy.allowedChainIds.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleChain(id)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: `1px solid ${active ? "var(--accent-border)" : "var(--border-subtle)"}`,
                  background: active ? "var(--accent-bg)" : "var(--bg-primary)",
                  color: active ? "var(--accent-light)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.2s ease",
                }}
              >
                <span>{CHAIN_ICONS[id] || "⟐"}</span>
                {name}
                {active && <span style={{ fontSize: 12 }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Allowed Protocols */}
      <div className="card" style={{ padding: 24 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "block" }}>
          Allowed Protocols
          <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 8 }}>
            (leave empty to allow all)
          </span>
        </label>

        {/* Current protocols */}
        {policy.allowedProtocols.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {policy.allowedProtocols.map((p) => (
              <span
                key={p}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--accent-light)",
                }}
              >
                {p}
                <button
                  onClick={() => removeProtocol(p)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add protocol */}
        <div style={{ display: "flex", gap: 8 }}>
          <select
            className="input"
            style={{ flex: 1 }}
            value={newProtocol}
            onChange={(e) => {
              if (e.target.value) addProtocol(e.target.value);
            }}
          >
            <option value="">Select a protocol...</option>
            {availableProtocols
              .filter((p) => !policy.allowedProtocols.map(pp => pp.toLowerCase()).includes(p.toLowerCase()))
              .map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </select>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Or type protocol name..."
            value={newProtocol}
            onChange={(e) => setNewProtocol(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addProtocol(newProtocol);
            }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => addProtocol(newProtocol)}>
            Add
          </button>
        </div>
      </div>

      {/* Numeric Rules */}
      <div className="card" style={{ padding: 24 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, display: "block" }}>
          Threshold Rules
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <NumberField
            label="Minimum TVL (USD)"
            value={policy.minTvlUsd}
            onChange={(v) => setPolicy((prev) => ({ ...prev, minTvlUsd: v }))}
            step={100000}
            min={0}
          />
          <NumberField
            label="Minimum APY (%)"
            value={policy.minApy}
            onChange={(v) => setPolicy((prev) => ({ ...prev, minApy: v }))}
            step={0.5}
            min={0}
          />
          <NumberField
            label="Max Protocol Exposure (%)"
            value={policy.maxProtocolExposurePct}
            onChange={(v) => setPolicy((prev) => ({ ...prev, maxProtocolExposurePct: v }))}
            step={5}
            min={1}
            max={100}
          />
          <NumberField
            label="Min Idle Cash (%)"
            value={policy.minIdleCashPct}
            onChange={(v) => setPolicy((prev) => ({ ...prev, minIdleCashPct: v }))}
            step={1}
            min={0}
            max={100}
          />
        </div>
      </div>

      {/* Advanced Route Settings — collapsible */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <button
          onClick={() => setShowRouteSettings(!showRouteSettings)}
          style={{
            width: "100%",
            padding: "16px 24px",
            background: "none",
            border: "none",
            borderBottom: showRouteSettings ? "1px solid var(--border-subtle)" : "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>⚙ Advanced Route Settings</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(139,92,246,0.1)", color: "rgba(139,92,246,0.8)" }}>
              LI.FI Controls
            </span>
          </div>
          <span style={{ fontSize: 16, transform: showRouteSettings ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </button>

        {showRouteSettings && (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Route Order + Preset */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>
                  Route Order
                </label>
                <div className="tab-nav">
                  <button
                    className={`tab-btn ${policy.routePreferences.order === "CHEAPEST" ? "tab-btn-active" : ""}`}
                    onClick={() => updateRoutePrefs({ order: "CHEAPEST" })}
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    💰 Cheapest
                  </button>
                  <button
                    className={`tab-btn ${policy.routePreferences.order === "FASTEST" ? "tab-btn-active" : ""}`}
                    onClick={() => updateRoutePrefs({ order: "FASTEST" })}
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    ⚡ Fastest
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>
                  Preset
                </label>
                <div className="tab-nav">
                  <button
                    className={`tab-btn ${policy.routePreferences.preset === "stablecoin" ? "tab-btn-active" : ""}`}
                    onClick={() => updateRoutePrefs({ preset: policy.routePreferences.preset === "stablecoin" ? "" : "stablecoin" })}
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    🪙 Stablecoin
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Prefer stablecoin-only routes
                </div>
              </div>
            </div>

            {/* Bridges */}
            {toolsLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                Loading bridges & exchanges from LI.FI...
              </div>
            ) : bridges.length > 0 && (
              <>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                    Bridges
                    <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 8, fontSize: 11 }}>
                      ({bridges.length} available)
                    </span>
                  </label>
                  <ToolSelector
                    tools={bridges}
                    allowed={policy.routePreferences.allowBridges}
                    preferred={policy.routePreferences.preferredBridges}
                    onToggleAllow={(key) => toggleListItem("allowBridges", key)}
                    onTogglePreferred={(key) => toggleListItem("preferredBridges", key)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                    Exchanges
                    <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 8, fontSize: 11 }}>
                      ({exchanges.length} available)
                    </span>
                  </label>
                  <ToolSelector
                    tools={exchanges}
                    allowed={policy.routePreferences.allowExchanges}
                    preferred={policy.routePreferences.preferredExchanges}
                    onToggleAllow={(key) => toggleListItem("allowExchanges", key)}
                    onTogglePreferred={(key) => toggleListItem("preferredExchanges", key)}
                  />
                </div>
              </>
            )}

            <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
              💡 <strong>Allowed</strong> = restrict routes to these tools only. <strong>Preferred</strong> = suggest these when possible.
              Leave both empty to allow all.
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave}>
          {saved ? "✓ Saved!" : "Save Policy"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            const def = { ...loadPolicy() };
            setPolicy(def);
          }}
        >
          Reset to Saved
        </button>
        {saved && (
          <span style={{ color: "var(--compliant)", fontSize: 14, fontWeight: 600 }}>
            Policy saved successfully
          </span>
        )}
      </div>
    </div>
  );
}

/** Tool selector: compact grid of bridge/exchange pills with allow/preferred toggles */
function ToolSelector({
  tools,
  allowed,
  preferred,
  onToggleAllow,
  onTogglePreferred,
}: {
  tools: ToolInfo[];
  allowed: string[];
  preferred: string[];
  onToggleAllow: (key: string) => void;
  onTogglePreferred: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleTools = expanded ? tools : tools.slice(0, 8);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {visibleTools.map((tool) => {
          const isAllowed = allowed.includes(tool.key);
          const isPreferred = preferred.includes(tool.key);
          return (
            <div
              key={tool.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${isAllowed ? "rgba(16,185,129,0.4)" : isPreferred ? "rgba(139,92,246,0.4)" : "var(--border-subtle)"}`,
                background: isAllowed ? "rgba(16,185,129,0.08)" : isPreferred ? "rgba(139,92,246,0.08)" : "var(--bg-primary)",
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <span
                onClick={() => onToggleAllow(tool.key)}
                title="Toggle allowed"
                style={{ color: isAllowed ? "var(--compliant)" : "var(--text-muted)", fontWeight: isAllowed ? 700 : 400 }}
              >
                {isAllowed ? "✓" : "○"}
              </span>
              <span style={{ color: isAllowed || isPreferred ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {tool.name}
              </span>
              <span
                onClick={() => onTogglePreferred(tool.key)}
                title="Toggle preferred"
                style={{ color: isPreferred ? "rgba(139,92,246,0.9)" : "var(--text-muted)", cursor: "pointer", fontSize: 11 }}
              >
                {isPreferred ? "★" : "☆"}
              </span>
            </div>
          );
        })}
      </div>
      {tools.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: "none", border: "none", color: "var(--accent-light)", fontSize: 12, marginTop: 6, cursor: "pointer", padding: 0 }}
        >
          {expanded ? "Show less" : `Show all ${tools.length}`}
        </button>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
        {label}
      </label>
      <input
        className="input"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step}
        min={min}
        max={max}
      />
    </div>
  );
}
