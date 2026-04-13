// ============================================================
// Lightweight Wallet Hook — uses window.ethereum directly
// No wagmi, no viem, no heavy bundles
// ============================================================

"use client";

import { useState, useCallback, useEffect } from "react";
import { USDC_ADDRESSES } from "@/lib/lifi-client";

interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).ethereum ?? null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
  });
  const [isPending, setIsPending] = useState(false);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      alert("Please install MetaMask or another Ethereum wallet.");
      return;
    }
    setIsPending(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(chainHex, 16);
      if (accounts[0]) {
        setState({ address: accounts[0], chainId, isConnected: true });
      }
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setIsPending(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ address: null, chainId: null, isConnected: false });
  }, []);

  const sendTransaction = useCallback(
    async (params: {
      to: string;
      data: string;
      value?: string;
      chainId?: number;
    }): Promise<string> => {
      const eth = getEthereum();
      if (!eth || !state.address) throw new Error("Wallet not connected");

      // Switch chain if needed
      if (params.chainId && params.chainId !== state.chainId) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${params.chainId.toString(16)}` }],
          });
        } catch (err) {
          console.error("Chain switch failed:", err);
          throw new Error("Please switch to the correct chain in your wallet");
        }
      }

      const txHash = (await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: state.address,
            to: params.to,
            data: params.data,
            value: params.value || "0x0",
          },
        ],
      })) as string;

      return txHash;
    },
    [state.address, state.chainId]
  );

  // Listen for account/chain changes
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accts = accounts as string[];
      if (accts.length === 0) {
        setState({ address: null, chainId: null, isConnected: false });
      } else {
        setState((prev) => ({ ...prev, address: accts[0], isConnected: true }));
      }
    };

    const handleChainChanged = (chainHex: unknown) => {
      const chainId = parseInt(chainHex as string, 16);
      setState((prev) => ({ ...prev, chainId }));
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    // Check if already connected
    eth.request({ method: "eth_accounts" }).then((accounts) => {
      const accts = accounts as string[];
      if (accts.length > 0) {
        eth.request({ method: "eth_chainId" }).then((chainHex) => {
          setState({
            address: accts[0],
            chainId: parseInt(chainHex as string, 16),
            isConnected: true,
          });
        });
      }
    });

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  return {
    ...state,
    isPending,
    connect,
    disconnect,
    sendTransaction,
  };
}

// ============================================================
// Standalone helpers (not hooks — safe to call from callbacks)
// ============================================================

/**
 * Poll eth_getTransactionReceipt until it resolves or timeoutMs elapses.
 * Returns { confirmed: true, status } or { confirmed: false } on timeout.
 */
export async function waitForTransactionReceipt(
  hash: string,
  timeoutMs: number = 60_000
): Promise<{ confirmed: boolean; success: boolean }> {
  const eth = getEthereum();
  if (!eth) return { confirmed: false, success: false };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = (await eth.request({
        method: "eth_getTransactionReceipt",
        params: [hash],
      })) as { status: string } | null;

      if (receipt !== null) {
        // status "0x1" = success, "0x0" = revert
        return { confirmed: true, success: receipt.status === "0x1" };
      }
    } catch {
      // node may not have indexed yet, keep polling
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { confirmed: false, success: false };
}

/**
 * Read the USDC balance (6 decimals) of an address on the current chain.
 * Returns human-readable USD value (assuming 1 USDC = $1).
 */
export async function getUsdcBalance(
  address: string,
  chainId: number
): Promise<number> {
  const eth = getEthereum();
  if (!eth) return 0;

  const usdcAddr = USDC_ADDRESSES[chainId];
  if (!usdcAddr) return 0;

  try {
    // balanceOf(address) selector = 0x70a08231
    const data =
      "0x70a08231" + address.slice(2).padStart(64, "0");

    const balHex = (await eth.request({
      method: "eth_call",
      params: [{ to: usdcAddr, data }, "latest"],
    })) as string;

    const raw = BigInt(balHex || "0");
    return Number(raw) / 1e6;
  } catch {
    return 0;
  }
}
