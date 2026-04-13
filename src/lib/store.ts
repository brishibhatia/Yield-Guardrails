// ============================================================
// Local Policy Store — localStorage persistence
// ============================================================

import { Policy, DEFAULT_POLICY, Transaction } from "@/types";

const POLICY_KEY = "yield-guardrails-policy";
const TX_KEY = "yield-guardrails-transactions";

export function loadPolicy(): Policy {
  if (typeof window === "undefined") return DEFAULT_POLICY;
  try {
    const raw = localStorage.getItem(POLICY_KEY);
    if (!raw) return DEFAULT_POLICY;
    return JSON.parse(raw) as Policy;
  } catch {
    return DEFAULT_POLICY;
  }
}

export function savePolicy(policy: Policy): void {
  if (typeof window === "undefined") return;
  policy.updatedAt = Date.now();
  localStorage.setItem(POLICY_KEY, JSON.stringify(policy));
}

export function loadTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Transaction[];
  } catch {
    return [];
  }
}

export function saveTransaction(tx: Transaction): void {
  if (typeof window === "undefined") return;
  const txs = loadTransactions();
  const idx = txs.findIndex((t) => t.id === tx.id);
  if (idx >= 0) {
    txs[idx] = tx;
  } else {
    txs.unshift(tx);
  }
  // Keep last 50
  localStorage.setItem(TX_KEY, JSON.stringify(txs.slice(0, 50)));
}

/**
 * Update a transaction's status by hash. Returns true if found and updated.
 */
export function updateTransactionStatus(
  hash: string,
  status: Transaction["status"]
): boolean {
  if (typeof window === "undefined") return false;
  const txs = loadTransactions();
  const tx = txs.find((t) => t.hash === hash);
  if (!tx) return false;
  tx.status = status;
  localStorage.setItem(TX_KEY, JSON.stringify(txs));
  return true;
}
