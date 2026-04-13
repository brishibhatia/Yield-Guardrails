"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { VaultExplorer } from "@/components/VaultExplorer";
import { PolicyBuilder } from "@/components/PolicyBuilder";
import { Portfolio } from "@/components/Portfolio";
import { RepairFlow } from "@/components/RepairFlow";
import { Activity } from "@/components/Activity";
import { fetchEarnVaults, fetchPortfolioPositions, fetchLifiChains, fetchLifiProtocols } from "@/lib/lifi-client";
import { evaluatePortfolio } from "@/lib/policy-engine";
import { loadPolicy, savePolicy } from "@/lib/store";
import { DEMO_POSITIONS, DEMO_VAULTS, DEMO_POLICY } from "@/lib/demo-data";
import type { Policy, Vault, Position, PositionWithStatus } from "@/types";

export default function Home() {
  const { address, isConnected } = useWallet();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Data state
  const [policy, setPolicy] = useState<Policy>(() => loadPolicy());
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [evaluatedPositions, setEvaluatedPositions] = useState<PositionWithStatus[]>([]);
  const [availableProtocols, setAvailableProtocols] = useState<string[]>([]);

  // LI.FI coverage data
  const [lifiChainCount, setLifiChainCount] = useState<number>(0);
  const [lifiProtocolCount, setLifiProtocolCount] = useState<number>(0);

  // Loading states
  const [vaultsLoading, setVaultsLoading] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(false);

  // Repair flow
  const [repairTarget, setRepairTarget] = useState<{
    vault: Vault;
    sourcePosition?: PositionWithStatus;
    sourceChainId?: number;
  } | null>(null);

  // Active policy (demo overrides real)
  const activePolicy = isDemoMode ? DEMO_POLICY : policy;
  const activeVaults = isDemoMode ? DEMO_VAULTS : vaults;
  const activePositions = isDemoMode ? DEMO_POSITIONS : positions;

  // Toggle demo mode
  const toggleDemo = useCallback(() => {
    setIsDemoMode((prev) => !prev);
    setRepairTarget(null);
  }, []);

  // Fetch LI.FI coverage stats (chains + protocols)
  useEffect(() => {
    async function loadCoverage() {
      const [chains, protocols] = await Promise.all([
        fetchLifiChains(),
        fetchLifiProtocols(),
      ]);
      if (chains.length > 0) setLifiChainCount(chains.length);
      if (protocols.length > 0) setLifiProtocolCount(protocols.length);
    }
    loadCoverage();
  }, []);

  // Load vaults
  const loadVaults = useCallback(async () => {
    if (isDemoMode) return;
    setVaultsLoading(true);
    try {
      const v = await fetchEarnVaults("USDC");
      setVaults(v);
      const protocols = [...new Set(v.map((vault) => vault.protocolName))].sort();
      setAvailableProtocols(protocols);
    } catch (err) {
      console.error("Failed to load vaults:", err);
    } finally {
      setVaultsLoading(false);
    }
  }, [isDemoMode]);

  // Load positions
  const loadPositions = useCallback(async () => {
    if (isDemoMode || !address) return;
    setPositionsLoading(true);
    try {
      const p = await fetchPortfolioPositions(address);
      setPositions(p);
    } catch (err) {
      console.error("Failed to load positions:", err);
    } finally {
      setPositionsLoading(false);
    }
  }, [address, isDemoMode]);

  // Evaluate positions
  useEffect(() => {
    if (activePositions.length > 0) {
      const evaluated = evaluatePortfolio(activePositions, activePolicy, activeVaults);
      setEvaluatedPositions(evaluated);
    } else {
      setEvaluatedPositions([]);
    }
  }, [activePositions, activePolicy, activeVaults]);

  // Extract protocols from vaults
  useEffect(() => {
    const protocols = [...new Set(activeVaults.map((v) => v.protocolName))].sort();
    setAvailableProtocols(protocols);
  }, [activeVaults]);

  // Initial loads
  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  useEffect(() => {
    if (isConnected && address) {
      loadPositions();
    }
  }, [isConnected, address, loadPositions]);

  const handlePolicyChange = useCallback((p: Policy) => {
    setPolicy(p);
    savePolicy(p);
  }, []);

  const handleDepositClick = useCallback((vault: Vault) => {
    if (!vault.isTransactional) return; // guard: non-transactional vaults can't be deposited
    setRepairTarget({ vault });
  }, []);

  const handleRepairClick = useCallback((position: PositionWithStatus, vault: Vault) => {
    setRepairTarget({ vault, sourcePosition: position, sourceChainId: position.chainId });
  }, []);

  const handleRepairSuccess = useCallback(() => {
    loadPositions();
    setActiveTab("activity");
  }, [loadPositions]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header activeTab={activeTab} onTabChange={setActiveTab} isDemoMode={isDemoMode} onToggleDemo={toggleDemo} />

      <main className="container" style={{ flex: 1, paddingTop: 24, paddingBottom: 40 }}>
        {/* Demo banner */}
        {isDemoMode && (
          <div style={{
            padding: "12px 20px",
            marginBottom: 20,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))",
            border: "1px solid rgba(139,92,246,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "rgb(167,139,250)" }}>🎯 Demo Mode</span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 8 }}>
                Seeded treasury with 1 violation, 1 warning, 2 compliant positions. No wallet needed.
              </span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={toggleDemo}>Exit Demo</button>
          </div>
        )}

        {activeTab === "dashboard" && (
          <Dashboard positions={evaluatedPositions} policy={activePolicy} vaults={activeVaults} onNavigate={setActiveTab} lifiChainCount={lifiChainCount} lifiProtocolCount={lifiProtocolCount} />
        )}
        {activeTab === "vaults" && (
          <VaultExplorer vaults={activeVaults} loading={vaultsLoading} policy={activePolicy} onDepositClick={handleDepositClick} lifiChainCount={lifiChainCount} lifiProtocolCount={lifiProtocolCount} />
        )}
        {activeTab === "policy" && (
          <PolicyBuilder onPolicyChange={handlePolicyChange} availableProtocols={availableProtocols} />
        )}
        {activeTab === "portfolio" && (
          <Portfolio positions={evaluatedPositions} vaults={activeVaults} policy={activePolicy} loading={positionsLoading} onRepairClick={handleRepairClick} onRefresh={isDemoMode ? () => {} : loadPositions} />
        )}
        {activeTab === "activity" && <Activity />}
      </main>

      {repairTarget && (
        <RepairFlow
          targetVault={repairTarget.vault}
          sourcePosition={repairTarget.sourcePosition}
          sourceChainId={repairTarget.sourceChainId}
          positions={activePositions}
          policy={activePolicy}
          vaults={activeVaults}
          isDemoMode={isDemoMode}
          onClose={() => setRepairTarget(null)}
          onSuccess={handleRepairSuccess}
        />
      )}

      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "16px 0" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--text-muted)" }}>
          <span>Yield Guardrails • Policy-based stablecoin treasury</span>
          <span>Powered by LI.FI</span>
        </div>
      </footer>
    </div>
  );
}
