"use client";

import { WalletButton } from "@/components/WalletButton";

export function Header({
  activeTab,
  onTabChange,
  isDemoMode,
  onToggleDemo,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDemoMode?: boolean;
  onToggleDemo?: () => void;
}) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "vaults", label: "Vaults", icon: "⬡" },
    { id: "policy", label: "Policy", icon: "⛨" },
    { id: "portfolio", label: "Portfolio", icon: "◎" },
    { id: "activity", label: "Activity", icon: "↻" },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(10, 11, 15, 0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            ⛨
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Yield Guardrails
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              POLICY-BASED TREASURY
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="tab-nav" style={{ display: "flex" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? "tab-btn-active" : ""}`}
              onClick={() => onTabChange(tab.id)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              <span className="hide-mobile">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Demo + Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onToggleDemo && (
            <button
              onClick={onToggleDemo}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: isDemoMode ? "1px solid rgba(139,92,246,0.5)" : "1px solid var(--border-subtle)",
                background: isDemoMode ? "rgba(139,92,246,0.15)" : "transparent",
                color: isDemoMode ? "rgb(167,139,250)" : "var(--text-secondary)",
                transition: "all 0.2s ease",
              }}
            >
              {isDemoMode ? "🎯 Demo ON" : "🎯 Demo"}
            </button>
          )}
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
