"use client";

import { useState, useEffect, useCallback } from "react";
import { Transaction, CHAIN_NAMES } from "@/types";
import { loadTransactions } from "@/lib/store";
import { shortenAddress } from "@/lib/utils";

export function Activity() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions());

  // Refresh transactions on focus, storage events, and periodic polling
  const refresh = useCallback(() => {
    setTransactions(loadTransactions());
  }, []);

  useEffect(() => {
    // Poll every 5s for status changes (from RepairFlow updating localStorage)
    const interval = setInterval(refresh, 5000);

    // Refresh on window focus
    window.addEventListener("focus", refresh);

    // Refresh on storage events (cross-tab or same-tab manual dispatches)
    window.addEventListener("storage", refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  if (transactions.length === 0) {
    return (
      <div className="card animate-fade-in" style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>↻</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No recent activity</div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Transactions will appear here after you deposit or repair positions.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Recent Activity</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Transaction history and repair results
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Status indicator */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                background:
                  tx.status === "confirmed"
                    ? "var(--compliant-bg)"
                    : tx.status === "failed"
                    ? "var(--violating-bg)"
                    : "var(--accent-bg)",
                border: `1px solid ${
                  tx.status === "confirmed"
                    ? "var(--compliant-border)"
                    : tx.status === "failed"
                    ? "var(--violating-border)"
                    : "var(--accent-border)"
                }`,
                flexShrink: 0,
              }}
            >
              {tx.status === "confirmed" ? "✓" : tx.status === "failed" ? "✗" : "⏳"}
            </div>

            {/* Details */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                {tx.type === "deposit" ? "Deposit" : "Repair"} — {tx.amount} USDC
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {CHAIN_NAMES[tx.sourceChainId] || `Chain ${tx.sourceChainId}`}
                {tx.sourceChainId !== tx.targetChainId && ` → ${CHAIN_NAMES[tx.targetChainId] || `Chain ${tx.targetChainId}`}`}
                {" • "}
                {tx.targetVault}
              </div>
            </div>

            {/* Hash & time */}
            <div style={{ textAlign: "right" }}>
              {tx.explorerUrl ? (
                <a
                  href={tx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--accent-light)",
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                >
                  {shortenAddress(tx.hash)} ↗
                </a>
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {shortenAddress(tx.hash)}
                </span>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {new Date(tx.timestamp).toLocaleString()}
              </div>
            </div>

            {/* Status badge */}
            <span
              className={`badge ${
                tx.status === "confirmed"
                  ? "badge-compliant"
                  : tx.status === "failed"
                  ? "badge-violating"
                  : "badge-warning"
              }`}
            >
              {tx.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
