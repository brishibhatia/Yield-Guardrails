"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Vault, Position, PositionWithStatus, Policy, CHAIN_NAMES, CHAIN_ICONS, RouteInfo, RouteStep } from "@/types";
import { formatCompact, formatApy, getExplorerUrl } from "@/lib/utils";
import {
  fetchComposerQuote,
  fetchTransactionStatus,
  fetchPortfolioPositions,
  fetchEarnVaults,
  extractRouteInfo,
  USDC_ADDRESSES,
  QuoteResponse,
} from "@/lib/lifi-client";
import { saveTransaction, updateTransactionStatus } from "@/lib/store";
import { useWallet, waitForTransactionReceipt, getUsdcBalance } from "@/lib/wallet";
import {
  wouldViolateConcentration,
  checkIdleCash,
  simulateRepair,
  explainVaultCompliance,
  computePortfolioSnapshot,
  PortfolioSnapshot,
} from "@/lib/policy-engine";

type RepairStep = "configure" | "quoting" | "preview" | "approving" | "executing" | "polling" | "success" | "error";

export function RepairFlow({
  targetVault,
  sourcePosition,
  sourceChainId,
  positions,
  policy,
  vaults,
  isDemoMode,
  onClose,
  onSuccess,
}: {
  targetVault: Vault;
  sourcePosition?: PositionWithStatus;
  sourceChainId?: number;
  positions: Position[];
  policy: Policy;
  vaults: Vault[];
  isDemoMode?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { address, chainId: walletChainId, sendTransaction } = useWallet();
  const [step, setStep] = useState<RepairStep>("configure");
  const [amount, setAmount] = useState(sourcePosition ? sourcePosition.balanceNative : "");
  const [fromChainId, setFromChainId] = useState(sourceChainId || walletChainId || 1);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [txStatus, setTxStatus] = useState<string>("pending");
  const [policyWarnings, setPolicyWarnings] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Portfolio verification state (live mode only)
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "verified" | "partial" | "timeout">("idle");
  const [verifiedSnapshot, setVerifiedSnapshot] = useState<PortfolioSnapshot | null>(null);

  const isRepair = !!sourcePosition;
  const isCrossChain = fromChainId !== targetVault.chainId;
  const sourceToken = sourcePosition?.assetAddress || USDC_ADDRESSES[fromChainId];

  // Demo mode uses a placeholder address so the flow works without a real wallet
  const effectiveAddress = isDemoMode ? "0xDemoWallet000000000000000000000000001" : address;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ---- Repair simulation delta (before/after) ----
  const delta = useMemo<{ before: PortfolioSnapshot; after: PortfolioSnapshot } | null>(() => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return null;

    if (isRepair && sourcePosition) {
      return simulateRepair(sourcePosition, targetVault, sourcePosition.balanceUsd, positions, policy, vaults);
    }
    // For deposits, simulate adding to target
    const fakeSource: Position = {
      chainId: fromChainId, protocolName: "Wallet", vaultAddress: "0x0",
      assetAddress: "", assetSymbol: "USDC", assetDecimals: 6,
      balanceUsd: 0, balanceNative: "0", balanceAtomic: null,
    };
    return simulateRepair(fakeSource, targetVault, amt, positions, policy, vaults);
  }, [amount, isRepair, sourcePosition, targetVault, positions, policy, vaults, fromChainId]);

  // ---- "Why this vault?" explainer ----
  const vaultExplainer = useMemo(() => {
    const moveAmount = isRepair ? (sourcePosition?.balanceUsd || 0) : (parseFloat(amount) || 0);
    if (moveAmount <= 0) return [];
    return explainVaultCompliance(targetVault, policy, positions, moveAmount);
  }, [amount, isRepair, sourcePosition, targetVault, policy, positions]);

  // ---- Atomic amount derivation ----
  function deriveFromAmount(displayAmount: string): string | null {
    if (isRepair) {
      if (sourcePosition?.balanceAtomic) return sourcePosition.balanceAtomic;
      if (sourcePosition?.assetDecimals !== null && sourcePosition?.assetDecimals !== undefined) {
        const parsed = parseFloat(displayAmount);
        if (isNaN(parsed) || parsed <= 0) return null;
        return BigInt(Math.floor(parsed * Math.pow(10, sourcePosition.assetDecimals))).toString();
      }
      return null;
    }
    const parsed = parseFloat(displayAmount);
    if (isNaN(parsed) || parsed <= 0) return null;
    return BigInt(Math.floor(parsed * 1e6)).toString();
  }

  // ---- Generate simulated route info for demo mode ----
  function createDemoRouteInfo(): RouteInfo {
    const steps: RouteStep[] = [];
    const srcSymbol = sourcePosition?.assetSymbol || "USDC";

    // If source token is not USDC, add a swap step first
    if (srcSymbol !== "USDC") {
      steps.push({
        type: "swap",
        tool: "enso",
        toolName: "Enso Finance",
        fromChainId,
        toChainId: fromChainId,
        fromToken: srcSymbol,
        toToken: "USDC",
      });
    }

    // If cross-chain, add a bridge step
    if (isCrossChain) {
      steps.push({
        type: "cross",
        tool: "stargate",
        toolName: "Stargate V2",
        fromChainId,
        toChainId: targetVault.chainId,
        fromToken: "USDC",
        toToken: "USDC",
      });
    }

    // If same-chain and USDC, add a deposit step
    if (!isCrossChain && srcSymbol === "USDC") {
      steps.push({
        type: "swap",
        tool: "enso",
        toolName: "Enso Finance",
        fromChainId,
        toChainId: fromChainId,
        fromToken: "USDC",
        toToken: "USDC",
      });
    }

    return {
      tool: isCrossChain ? "stargate" : "enso",
      toolName: isCrossChain ? "Stargate V2" : "Enso Finance",
      type: isCrossChain ? "cross" : "lifi",
      estimatedDuration: isCrossChain ? 180 : 30,
      gasCostUsd: isCrossChain ? "2.45" : "0.85",
      feeCostUsd: isCrossChain ? "0.78" : "0.12",
      steps,
    };
  }

  // ---- Policy pre-checks ----
  const runPolicyChecks = useCallback(async (): Promise<boolean> => {
    const warnings: string[] = [];
    const depositUsd = parseFloat(amount) || 0;
    const cc = wouldViolateConcentration(targetVault, depositUsd, positions, policy);
    if (!cc.ok) warnings.push(cc.message!);
    if (!isRepair && address && walletChainId) {
      const usdcBal = await getUsdcBalance(address, fromChainId);
      const ic = checkIdleCash(depositUsd, usdcBal, policy, positions);
      if (!ic.ok) warnings.push(ic.message!);
    }
    setPolicyWarnings(warnings);
    return warnings.length === 0;
  }, [amount, targetVault, positions, policy, isRepair, address, walletChainId, fromChainId]);

  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      runPolicyChecks();
    } else {
      setPolicyWarnings([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromChainId]);

  // ---- Quote ----
  const getQuote = useCallback(async () => {
    if (!effectiveAddress || !amount) return;

    // Demo mode: generate simulated quote
    if (isDemoMode) {
      setStep("quoting");
      setError("");
      await new Promise(r => setTimeout(r, 800));

      const demoRoute = createDemoRouteInfo();
      setRouteInfo(demoRoute);

      const parsedAmount = parseFloat(amount) || 0;
      const toAmount = BigInt(Math.floor(parsedAmount * 0.997 * 1e6)).toString();

      const demoQuote: QuoteResponse = {
        id: `demo-${Date.now()}`,
        transactionRequest: {
          to: "0x1231DEB6f5749ef6cE6943a275A1D3E7486F4EaE",
          data: "0x",
          value: "0",
          chainId: fromChainId,
        },
        action: {},
        estimate: {
          toAmount,
          toAmountMin: toAmount,
          executionDuration: demoRoute.estimatedDuration,
          gasCosts: [{ amountUSD: demoRoute.gasCostUsd }],
          feeCosts: [{ amountUSD: demoRoute.feeCostUsd }],
        },
        includedSteps: demoRoute.steps.map(s => ({
          type: s.type,
          tool: s.tool,
          toolDetails: { name: s.toolName },
          action: {
            fromChainId: s.fromChainId,
            toChainId: s.toChainId,
            fromToken: { symbol: s.fromToken },
            toToken: { symbol: s.toToken },
          },
        })),
        tool: demoRoute.tool,
        toolDetails: { name: demoRoute.toolName },
        type: demoRoute.type,
      };

      setQuote(demoQuote);
      setStep("preview");
      return;
    }

    // Real mode
    if (isRepair && sourcePosition?.assetDecimals === null && !sourcePosition?.balanceAtomic) {
      setError("This position lacks token metadata needed for a safe repair quote.");
      setStep("error");
      return;
    }
    const fromAmount = deriveFromAmount(amount);
    if (!fromAmount) {
      setError("Invalid amount or missing token metadata.");
      setStep("error");
      return;
    }
    await runPolicyChecks();
    setStep("quoting");
    setError("");
    try {
      const fromToken = sourceToken;
      if (!fromToken) throw new Error(`No token address for chain ${fromChainId}`);
      const q = await fetchComposerQuote({
        fromChainId, fromToken,
        toChainId: targetVault.chainId, toToken: targetVault.address,
        fromAmount, fromAddress: effectiveAddress, slippage: 0.03,
        // Wire route preferences from policy
        order: policy.routePreferences.order,
        preset: policy.routePreferences.preset || undefined,
        allowBridges: policy.routePreferences.allowBridges.length > 0 ? policy.routePreferences.allowBridges : undefined,
        preferredBridges: policy.routePreferences.preferredBridges.length > 0 ? policy.routePreferences.preferredBridges : undefined,
        allowExchanges: policy.routePreferences.allowExchanges.length > 0 ? policy.routePreferences.allowExchanges : undefined,
        preferredExchanges: policy.routePreferences.preferredExchanges.length > 0 ? policy.routePreferences.preferredExchanges : undefined,
      });
      setQuote(q);
      setRouteInfo(extractRouteInfo(q));
      setStep("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to get quote");
      setStep("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAddress, amount, fromChainId, sourceToken, targetVault, isRepair, sourcePosition, isDemoMode, runPolicyChecks]);

  // ---- Approval ----
  const handleApprovalIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!quote?.estimate.approvalAddress || !address) return true;
    const approvalAddr = quote.estimate.approvalAddress;
    const tokenAddr = sourceToken;
    if (!tokenAddr) return true;
    try {
      setStep("approving");
      const eth = typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).ethereum as
            { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined
        : undefined;
      if (!eth) return true;

      // Check current allowance (safely handle non-standard responses)
      let allowance = BigInt(0);
      try {
        const allowanceData = "0xdd62ed3e" + address.slice(2).padStart(64, "0") + approvalAddr.slice(2).padStart(64, "0");
        const allowanceHex = (await eth.request({ method: "eth_call", params: [{ to: tokenAddr, data: allowanceData }, "latest"] })) as string;
        if (allowanceHex && allowanceHex.length > 2) {
          allowance = BigInt(allowanceHex);
        }
      } catch {
        // If allowance check fails, assume 0 and proceed to approve
        allowance = BigInt(0);
      }

      const fromAmount = deriveFromAmount(amount);
      const needed = fromAmount ? BigInt(fromAmount) : BigInt(0);
      if (needed > BigInt(0) && allowance >= needed) return true;
      if (needed === BigInt(0)) return true;
      const maxApproval = "0x" + "f".repeat(64);
      const approveData = "0x095ea7b3" + approvalAddr.slice(2).padStart(64, "0") + maxApproval.slice(2);
      await sendTransaction({ to: tokenAddr, data: approveData, chainId: fromChainId });
      return true;
    } catch (err: unknown) {
      // User rejected in MetaMask — not a real error
      const code = (err as { code?: number })?.code;
      const msg = err instanceof Error ? err.message : "";
      if (code === 4001 || msg.includes("rejected") || msg.includes("denied") || msg.includes("cancelled")) {
        setError("Approval cancelled by user.");
        setStep("configure");
        return false;
      }
      console.error("Approval failed:", err);
      setError("Token approval failed. Please try again.");
      setStep("error");
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, address, sourceToken, amount, fromChainId, sendTransaction]);

  // ---- Cross-chain polling ----
  const pollCrossChainStatus = useCallback((hash: string) => {
    setStep("polling");
    pollRef.current = setInterval(async () => {
      try {
        const result = await fetchTransactionStatus(hash, fromChainId, targetVault.chainId);
        setTxStatus(result.status);
        if (result.status === "DONE" || result.status === "COMPLETED") {
          if (pollRef.current) clearInterval(pollRef.current);
          updateTransactionStatus(hash, "confirmed");
          setStep("success");
        } else if (result.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          updateTransactionStatus(hash, "failed");
          setError("Transaction failed on-chain.");
          setStep("error");
        }
      } catch { /* retry */ }
    }, 5000);
  }, [fromChainId, targetVault.chainId]);

  // ---- Execute ----
  const executeTransaction = useCallback(async () => {
    if (!quote) return;

    // Demo mode: simulate the full execution lifecycle
    if (isDemoMode) {
      setStep("executing");
      await new Promise(r => setTimeout(r, 600));
      setStep("polling");
      setTxStatus("Processing...");
      await new Promise(r => setTimeout(r, 1200));
      setTxStatus(isCrossChain ? "Bridging cross-chain..." : "Confirming on-chain...");
      await new Promise(r => setTimeout(r, 1000));
      setStep("success");
      setVerificationStatus("idle"); // demo doesn't verify
      return;
    }

    // Real mode
    const approved = await handleApprovalIfNeeded();
    if (!approved) return;
    setStep("executing");
    setError("");
    try {
      const txReq = quote.transactionRequest;
      const hash = await sendTransaction({
        to: txReq.to, data: txReq.data,
        value: txReq.value ? `0x${BigInt(txReq.value).toString(16)}` : "0x0",
        chainId: txReq.chainId,
      });
      setTxHash(hash);
      saveTransaction({
        id: `tx-${Date.now()}`, hash, chainId: txReq.chainId, status: "pending",
        type: isRepair ? "repair" : "deposit", amount,
        sourceChainId: fromChainId, targetChainId: targetVault.chainId,
        targetVault: targetVault.name, timestamp: Date.now(),
        explorerUrl: getExplorerUrl(txReq.chainId, hash),
      });
      if (fromChainId === targetVault.chainId) {
        setStep("polling");
        setTxStatus("confirming on-chain...");
        const receipt = await waitForTransactionReceipt(hash, 90_000);
        if (receipt.confirmed) {
          updateTransactionStatus(hash, receipt.success ? "confirmed" : "failed");
          if (receipt.success) {
            setStep("success");
            verifyPortfolio();
          }
          else { setError("Transaction reverted on-chain."); setStep("error"); }
        } else {
          setStep("success");
          verifyPortfolio();
        }
      } else {
        pollCrossChainStatus(hash);
      }
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      const msg = err instanceof Error ? err.message : "";
      if (code === 4001 || msg.includes("rejected") || msg.includes("denied") || msg.includes("cancelled")) {
        setError("Transaction cancelled by user.");
        setStep("configure");
      } else {
        setError(msg || "Transaction failed");
        setStep("error");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, isDemoMode, isCrossChain, handleApprovalIfNeeded, sendTransaction, amount, fromChainId, targetVault, isRepair, pollCrossChainStatus]);

  // ---- Portfolio verification (live mode) ----
  const verifyPortfolio = useCallback(async () => {
    if (isDemoMode || !address) return;
    setVerificationStatus("verifying");
    // Poll up to 3 times with 8s delay to allow indexing
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise(r => setTimeout(r, 8000));
      try {
        const updatedPositions = await fetchPortfolioPositions(address);
        // Check if the target vault appears in the updated positions
        const targetFound = updatedPositions.some(
          (p) => p.vaultAddress.toLowerCase() === targetVault.address.toLowerCase()
            && p.chainId === targetVault.chainId
        );
        // Check if source position is reduced or gone (for repairs)
        let sourceReduced = true;
        if (isRepair && sourcePosition) {
          const sourceStill = updatedPositions.find(
            (p) => p.vaultAddress.toLowerCase() === sourcePosition.vaultAddress.toLowerCase()
              && p.chainId === sourcePosition.chainId
          );
          sourceReduced = !sourceStill || sourceStill.balanceUsd < sourcePosition.balanceUsd * 0.95;
        }

        if (targetFound && sourceReduced) {
          // Full verification — recompute health from refreshed portfolio
          try {
            const freshVaults = await fetchEarnVaults("USDC");
            const snap = computePortfolioSnapshot(updatedPositions, policy, freshVaults.length > 0 ? freshVaults : vaults);
            setVerifiedSnapshot(snap);
          } catch {
            // Fall back without snapshot
          }
          setVerificationStatus("verified");
          return;
        }
        if (targetFound && !sourceReduced) {
          // Partial: target appeared but source not yet reduced
          setVerificationStatus("partial");
          return;
        }
      } catch {
        // continue polling
      }
    }
    setVerificationStatus("timeout");
  }, [isDemoMode, address, targetVault, isRepair, sourcePosition, policy, vaults]);

  const metadataMissing = isRepair && sourcePosition?.assetDecimals === null && !sourcePosition?.balanceAtomic;
  const hasBlockingWarnings = policyWarnings.length > 0;

  // Generate plain-English route description
  const routeDescription = useMemo(() => {
    if (!routeInfo) return null;
    const fromChain = CHAIN_NAMES[fromChainId] || `Chain ${fromChainId}`;
    const toChain = CHAIN_NAMES[targetVault.chainId] || `Chain ${targetVault.chainId}`;
    const srcSymbol = sourcePosition?.assetSymbol || "USDC";

    if (isCrossChain) {
      if (srcSymbol !== "USDC") {
        return `LI.FI will swap ${srcSymbol} to USDC on ${fromChain}, bridge it to ${toChain} via ${routeInfo.toolName}, then deposit into ${targetVault.name}.`;
      }
      return `LI.FI will bridge USDC from ${fromChain} to ${toChain} via ${routeInfo.toolName}, then deposit into ${targetVault.name}.`;
    }
    return `LI.FI will deposit USDC into ${targetVault.name} on ${toChain}.`;
  }, [routeInfo, fromChainId, targetVault, sourcePosition, isCrossChain]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card animate-fade-in" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", padding: 0 }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>
              {step === "success"
                ? (isRepair ? "Repair Complete" : "Deposit Confirmed")
                : isRepair
                  ? (isCrossChain ? "⛓ Cross-Chain Repair" : "Repair Position")
                  : "Deposit to Vault"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {isCrossChain
                ? `${CHAIN_NAMES[fromChainId]} → ${CHAIN_NAMES[targetVault.chainId]} via LI.FI`
                : "via LI.FI Composer"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Source position */}
          {sourcePosition && (
            <div style={{ padding: 16, background: "var(--violating-bg)", borderRadius: 10, border: "1px solid var(--violating-border)" }}>
              <div style={{ fontSize: 12, color: "var(--violating)", textTransform: "uppercase", marginBottom: 8 }}>
                {isCrossChain ? "Source — Cross-Chain Violation" : "Source (Violating Position)"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{sourcePosition.protocolName} — {sourcePosition.assetSymbol}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {CHAIN_ICONS[sourcePosition.chainId]} {CHAIN_NAMES[sourcePosition.chainId]} • {sourcePosition.balanceNative} {sourcePosition.assetSymbol} (${sourcePosition.balanceUsd.toLocaleString()})
              </div>
              {sourcePosition.violations.map((v, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--violating)", marginTop: 4 }}>✗ {v.message}</div>
              ))}
            </div>
          )}

          {/* Target vault */}
          <div style={{ padding: 16, background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Target Vault</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{targetVault.name}</div>
            <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-secondary)", flexWrap: "wrap" }}>
              <span>{CHAIN_ICONS[targetVault.chainId]} {CHAIN_NAMES[targetVault.chainId]}</span>
              <span>{targetVault.protocolName}</span>
              <span style={{ color: "var(--compliant)" }}>{formatApy(targetVault.apyTotal)} APY</span>
              <span>TVL {formatCompact(targetVault.tvlUsd)}</span>
            </div>
          </div>

          {/* ===== CONFIGURE ===== */}
          {(step === "configure" || step === "error") && (
            <>
              {metadataMissing && (
                <div style={{ padding: 12, background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 8, color: "var(--warning)", fontSize: 13 }}>
                  ⚠ This position lacks token metadata needed for a safe repair quote.
                </div>
              )}

              <div>
                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Source Chain</label>
                <select className="input" value={fromChainId} onChange={(e) => setFromChainId(Number(e.target.value))}>
                  {Object.entries(CHAIN_NAMES).map(([id, name]) => (
                    <option key={id} value={id}>{CHAIN_ICONS[Number(id)]} {name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                  Amount ({sourcePosition ? sourcePosition.assetSymbol : "USDC"})
                </label>
                <input className="input" type="number" placeholder="100.00" value={amount} onChange={(e) => setAmount(e.target.value)} step="any" min="0" />
              </div>

              {/* Before/After Delta preview (while configuring) */}
              {delta && <DeltaCard before={delta.before} after={delta.after} />}

              {/* Why This Vault? */}
              {vaultExplainer.length > 0 && (
                <div style={{ padding: 14, background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>Why this vault?</div>
                  {vaultExplainer.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: c.passes ? "var(--compliant)" : "var(--violating)", fontSize: 15, width: 18 }}>{c.passes ? "✓" : "✗"}</span>
                      <span style={{ color: c.passes ? "var(--text-primary)" : "var(--violating)" }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {policyWarnings.map((w, i) => (
                <div key={i} style={{ padding: 12, background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: 8, color: "var(--warning)", fontSize: 13 }}>
                  ⚠ {w}
                </div>
              ))}

              {error && (
                <div style={{ padding: 12, background: "var(--violating-bg)", border: "1px solid var(--violating-border)", borderRadius: 8, color: "var(--violating)", fontSize: 13, wordBreak: "break-word" }}>{error}</div>
              )}

              <button className="btn btn-primary btn-lg" onClick={getQuote} disabled={!effectiveAddress || !amount || parseFloat(amount) <= 0 || metadataMissing || hasBlockingWarnings} style={{ width: "100%" }}>
                {!effectiveAddress ? "Connect Wallet First" : metadataMissing ? "Missing Token Metadata" : hasBlockingWarnings ? "Blocked by Policy" : "Get Quote"}
              </button>
            </>
          )}

          {/* ===== QUOTING ===== */}
          {step === "quoting" && <Spinner message="Getting quote..." sub="Fetching the best route via LI.FI" />}

          {/* ===== PREVIEW — Route Transparency ===== */}
          {step === "preview" && quote && (
            <>
              {/* Route Transparency Panel */}
              <div style={{ padding: 16, background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))", borderRadius: 10, border: "1px solid rgba(139,92,246,0.2)" }}>
                <div style={{ fontSize: 12, color: "rgba(167,139,250,0.9)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, fontWeight: 600 }}>
                  🔗 LI.FI Route Details
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <QR label="From" value={`${amount} ${sourcePosition?.assetSymbol || "USDC"} on ${CHAIN_NAMES[fromChainId]}`} />
                  <QR label="To" value={`${targetVault.name} on ${CHAIN_NAMES[targetVault.chainId]}`} />
                  {routeInfo && (
                    <>
                      <QR label="Bridge / Tool" value={routeInfo.toolName} />
                      <QR label="Route Type" value={isCrossChain ? "Cross-chain" : "Same-chain"} />
                      <QR label="Steps" value={`${routeInfo.steps.length} step${routeInfo.steps.length !== 1 ? "s" : ""}`} />
                      <QR label="Est. Duration" value={routeInfo.estimatedDuration >= 60 ? `~${Math.ceil(routeInfo.estimatedDuration / 60)} min` : `~${routeInfo.estimatedDuration}s`} />
                      <QR label="Gas Cost" value={`$${routeInfo.gasCostUsd}`} />
                      <QR label="Fee Cost" value={`$${routeInfo.feeCostUsd}`} />
                    </>
                  )}
                  {!routeInfo && quote.estimate.executionDuration && <QR label="Est. Duration" value={`~${Math.ceil(quote.estimate.executionDuration / 60)} min`} />}
                  {!routeInfo && quote.tool && <QR label="Route" value={quote.tool} />}
                  <QR label="Min. Receive" value={`${(Number(quote.estimate.toAmountMin) / 1e6).toFixed(2)} USDC`} />
                </div>

                {/* Step-by-step breakdown */}
                {routeInfo && routeInfo.steps.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(139,92,246,0.15)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>ROUTE STEPS</div>
                    {routeInfo.steps.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 6, color: "var(--text-secondary)" }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(139,92,246,0.2)", color: "rgba(167,139,250,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        <span>
                          {s.type === "cross" ? "Bridge" : s.type === "swap" ? "Swap" : s.type}{" "}
                          <strong>{s.fromToken}</strong>
                          {s.fromChainId !== s.toChainId ? ` (${CHAIN_NAMES[s.fromChainId]})` : ""}{" → "}
                          <strong>{s.toToken}</strong>
                          {s.fromChainId !== s.toChainId ? ` (${CHAIN_NAMES[s.toChainId]})` : ""}{" "}
                          via <strong>{s.toolName}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Plain-English LI.FI explanation */}
                {routeDescription && (
                  <div style={{ marginTop: 12, padding: 10, background: "rgba(139,92,246,0.06)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    💡 {routeDescription}
                  </div>
                )}
              </div>

              {/* Delta card */}
              {delta && <DeltaCard before={delta.before} after={delta.after} />}

              {/* Approval notice */}
              {quote.estimate.approvalAddress && !isDemoMode && (
                <div style={{ padding: 8, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  Token approval will be requested before execution
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => { setStep("configure"); setQuote(null); setRouteInfo(null); }} style={{ flex: 1 }}>← Back</button>
                <button className="btn btn-primary btn-lg" onClick={executeTransaction} style={{ flex: 2 }}>
                  {isRepair ? (isCrossChain ? "Execute Cross-Chain Repair" : "Execute Repair") : "Execute Deposit"}
                </button>
              </div>
            </>
          )}

          {step === "approving" && <Spinner message="Approving token..." sub="Please confirm the approval in your wallet" />}
          {step === "executing" && <Spinner message={isDemoMode ? "Simulating transaction..." : "Submitting transaction..."} sub={isDemoMode ? "Demo mode — no real funds are moved" : "Please confirm in your wallet"} />}

          {step === "polling" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 40, gap: 16 }}>
              <div className="spinner" style={{ width: 40, height: 40 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {isDemoMode
                  ? "Simulating cross-chain transfer..."
                  : (fromChainId === targetVault.chainId ? "Confirming on-chain..." : "Processing cross-chain transfer...")}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Status: {txStatus}</div>
              {txHash && <a href={getExplorerUrl(fromChainId, txHash)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-light)", fontSize: 13 }}>View on Explorer →</a>}
            </div>
          )}

          {/* ===== SUCCESS — Verified After-State ===== */}
          {step === "success" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
              {/* Success icon */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--compliant-bg)", border: "2px solid var(--compliant-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {isRepair ? (isCrossChain ? "Cross-Chain Repair Complete!" : "Position Repaired!") : "Deposit Confirmed!"}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", margin: 0 }}>
                  {isRepair
                    ? `Moved ${amount} ${sourcePosition?.assetSymbol} from ${sourcePosition?.protocolName} (${CHAIN_NAMES[fromChainId]}) to ${targetVault.name} (${CHAIN_NAMES[targetVault.chainId]}).`
                    : `Deposited ${amount} USDC to ${targetVault.name}.`}
                </p>
              </div>

              {/* Verified After-State Panel */}
              {delta && (
                <div style={{ padding: 16, background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "rgba(16,185,129,0.9)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      {verificationStatus === "verified" ? "✓ Verified After-State" : verificationStatus === "verifying" ? "⟳ Verifying After-State..." : "✓ After-State"}
                    </div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: isDemoMode ? "rgba(139,92,246,0.15)" : verificationStatus === "verified" ? "rgba(16,185,129,0.15)" : "rgba(234,179,8,0.15)", color: isDemoMode ? "rgba(167,139,250,0.9)" : verificationStatus === "verified" ? "rgba(16,185,129,0.9)" : "rgba(234,179,8,0.9)" }}>
                      {isDemoMode ? "Simulated in demo mode" : verificationStatus === "verified" ? "Verified by LI.FI Earn portfolio" : verificationStatus === "verifying" ? "Verifying via Earn API..." : verificationStatus === "partial" ? "Target verified; source reduction pending" : verificationStatus === "timeout" ? "Transaction confirmed; portfolio verification pending" : "Verified by portfolio"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <DeltaRow label="Health Score" before={`${delta.before.healthScore}/100`} after={verifiedSnapshot ? `${verifiedSnapshot.healthScore}/100` : `${delta.after.healthScore}/100`} improved={verifiedSnapshot ? verifiedSnapshot.healthScore > delta.before.healthScore : delta.after.healthScore > delta.before.healthScore} />
                    <DeltaRow label="Violations" before={`${delta.before.violationCount}`} after={verifiedSnapshot ? `${verifiedSnapshot.violationCount}` : `${delta.after.violationCount}`} improved={verifiedSnapshot ? verifiedSnapshot.violationCount < delta.before.violationCount : delta.after.violationCount < delta.before.violationCount} />
                    <DeltaRow label="Warnings" before={`${delta.before.warningCount}`} after={verifiedSnapshot ? `${verifiedSnapshot.warningCount}` : `${delta.after.warningCount}`} improved={verifiedSnapshot ? verifiedSnapshot.warningCount < delta.before.warningCount : delta.after.warningCount < delta.before.warningCount} />
                    {delta.before.protocolExposures[0] && (
                      <DeltaRow
                        label={`${delta.before.protocolExposures[0].protocol} Exposure`}
                        before={`${delta.before.protocolExposures[0].pct.toFixed(1)}%`}
                        after={`${(delta.after.protocolExposures.find(e => e.protocol === delta.before.protocolExposures[0].protocol)?.pct ?? 0).toFixed(1)}%`}
                        improved={(delta.after.protocolExposures.find(e => e.protocol === delta.before.protocolExposures[0].protocol)?.pct ?? 0) < delta.before.protocolExposures[0].pct}
                      />
                    )}
                    <DeltaRow label="Target Position" before="—" after={`${targetVault.name}`} improved={true} />
                  </div>

                  {/* Summary badges */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    {delta.after.violationCount < delta.before.violationCount && (
                      <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "rgba(16,185,129,0.15)", color: "rgba(16,185,129,0.95)", fontWeight: 600 }}>
                        ✓ Violations Reduced
                      </span>
                    )}
                    {delta.after.healthScore > delta.before.healthScore && (
                      <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "rgba(16,185,129,0.15)", color: "rgba(16,185,129,0.95)", fontWeight: 600 }}>
                        ✓ Policy Improved
                      </span>
                    )}
                    {((delta.after.protocolExposures.find(e => e.protocol === delta.before.protocolExposures[0]?.protocol)?.pct ?? 0) < (delta.before.protocolExposures[0]?.pct ?? 0)) && (
                      <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "rgba(16,185,129,0.15)", color: "rgba(16,185,129,0.95)", fontWeight: 600 }}>
                        ✓ Exposure Reduced
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Route summary on success */}
              {routeInfo && (
                <div style={{ padding: 12, background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>
                  Route: {routeInfo.steps.length} step{routeInfo.steps.length !== 1 ? "s" : ""} via {routeInfo.toolName} • Gas: ${routeInfo.gasCostUsd} • Fees: ${routeInfo.feeCostUsd}
                </div>
              )}

              {txHash && <a href={getExplorerUrl(fromChainId, txHash)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-light)", fontSize: 14, textDecoration: "underline", textAlign: "center" }}>View on Explorer →</a>}

              <div style={{ display: "flex", gap: 12, width: "100%" }}>
                <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Close</button>
                <button className="btn btn-primary" onClick={() => { onSuccess(); onClose(); }} style={{ flex: 1 }}>
                  {isDemoMode ? "Back to Portfolio" : "Refresh Portfolio"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function Spinner({ message, sub }: { message: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 40, gap: 16 }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
      <div style={{ fontSize: 16, fontWeight: 600 }}>{message}</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{sub}</div>
    </div>
  );
}

function QR({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function DeltaCard({ before, after }: { before: PortfolioSnapshot; after: PortfolioSnapshot }) {
  return (
    <div style={{ padding: 16, background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(16,185,129,0.06))", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 14, letterSpacing: "0.05em" }}>
        Policy Impact — Before → After
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <DeltaRow label="Health Score" before={`${before.healthScore}/100`} after={`${after.healthScore}/100`} improved={after.healthScore > before.healthScore} />
        <DeltaRow label="Violations" before={`${before.violationCount}`} after={`${after.violationCount}`} improved={after.violationCount < before.violationCount} />
        {before.protocolExposures[0] && (
          <DeltaRow
            label={`${before.protocolExposures[0].protocol} Exposure`}
            before={`${before.protocolExposures[0].pct.toFixed(1)}%`}
            after={`${(after.protocolExposures.find(e => e.protocol === before.protocolExposures[0].protocol)?.pct ?? 0).toFixed(1)}%`}
            improved={(after.protocolExposures.find(e => e.protocol === before.protocolExposures[0].protocol)?.pct ?? 0) < before.protocolExposures[0].pct}
          />
        )}
        <DeltaRow label="Chains Used" before={`${before.chainMix.length}`} after={`${after.chainMix.length}`} improved={after.chainMix.length >= before.chainMix.length} />
        <DeltaRow label="Warnings" before={`${before.warningCount}`} after={`${after.warningCount}`} improved={after.warningCount < before.warningCount} />
      </div>
    </div>
  );
}

function DeltaRow({ label, before, after, improved }: { label: string; before: string; after: string; improved: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", minWidth: 50, textAlign: "right" }}>{before}</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>→</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: improved ? "var(--compliant)" : before === after ? "var(--text-secondary)" : "var(--violating)", minWidth: 50 }}>{after}</span>
      </div>
    </div>
  );
}
