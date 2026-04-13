"use client";

import { useState, useEffect } from "react";
import { Policy, CHAIN_NAMES, CHAIN_ICONS, SUPPORTED_CHAIN_IDS } from "@/types";
import { loadPolicy, savePolicy } from "@/lib/store";

export function PolicyBuilder({
  onPolicyChange,
  availableProtocols,
}: {
  onPolicyChange: (policy: Policy) => void;
  availableProtocols: string[];
}) {
  const [policy, setPolicy] = useState<Policy>(() => loadPolicy());
  const [saved, setSaved] = useState(false);
  const [newProtocol, setNewProtocol] = useState("");

  useEffect(() => {
    onPolicyChange(policy);
  }, [policy, onPolicyChange]);

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

      {/* Allowed Chains */}
      <div className="card" style={{ padding: 24 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "block" }}>
          Allowed Chains
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {SUPPORTED_CHAIN_IDS.map((id) => {
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
                <span>{CHAIN_ICONS[id]}</span>
                {CHAIN_NAMES[id]}
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
