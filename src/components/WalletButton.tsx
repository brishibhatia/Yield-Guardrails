"use client";

import { useWallet } from "@/lib/wallet";
import { shortenAddress } from "@/lib/utils";
import { CHAIN_NAMES } from "@/types";

export function WalletButton() {
  const { address, isConnected, chainId, isPending, connect, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {chainId && (
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 11,
              background: "var(--accent-bg)",
              color: "var(--accent-light)",
              border: "1px solid var(--accent-border)",
              fontWeight: 600,
            }}
          >
            {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
          </span>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={disconnect}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--compliant)",
            }}
          />
          {shortenAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <button
      className="btn btn-primary btn-sm"
      disabled={isPending}
      onClick={connect}
    >
      {isPending ? (
        <>
          <span className="spinner" style={{ width: 14, height: 14 }} />
          Connecting...
        </>
      ) : (
        "Connect Wallet"
      )}
    </button>
  );
}
