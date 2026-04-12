# Yield Guardrails

**Policy-based stablecoin treasury management** — *"Stripe Radar for stablecoin yield allocations"*

Built for the LI.FI Hackathon. Define treasury rules, discover LI.FI Earn vaults, detect policy violations, and generate one-click compliant repair or deposit using LI.FI Composer.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys (see below)

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Note**: First page load takes ~25s for webpack compile. After that it's instant (~130ms).

## Environment Variables

Create `.env.local` with:

```env
# LI.FI API Key — server-side only, never exposed to browser
# Get from https://docs.li.fi → API Access
LIFI_API_KEY=your-lifi-api-key-here
```

> The API key is only used server-side via Next.js API routes (`/api/vaults`, `/api/positions`, `/api/quote`, `/api/status`). It is **never** shipped to the browser.

## Demo Flow (Hackathon Walkthrough)

1. **Open app** → See Dashboard with policy summary, stats, and top policy-pass vaults
2. **Set Policy** → Policy tab → configure allowed chains, min TVL, min APY, max protocol exposure, min idle cash %
3. **Explore Vaults** → Vaults tab → browse USDC vaults, filter by chain/protocol, see compliance badges
4. **Connect Wallet** → Click "Connect Wallet" → approve in MetaMask
5. **View Portfolio** → Portfolio tab → per-position compliance status with violation messages and concentration-aware repair targets
6. **Repair** → Click "Repair" on a violating position → source position + violations shown → policy pre-checks (concentration, idle cash) → LI.FI Composer quote → ERC-20 approval → execute → receipt confirmation
7. **Deposit** → From Vaults tab → pick a policy-pass vault → enter USDC amount → idle cash + concentration checks → quote → execute
8. **Activity** → Activity tab → live transaction history (auto-updates as tx confirms)

## Tech Stack

- **Next.js 16** (App Router, webpack mode)
- **TypeScript** with strict typing
- **Tailwind CSS v4** + custom design system (glassmorphism, status colors)
- **Wallet integration** via `window.ethereum` (MetaMask / injected provider) — zero external wallet dependencies
- **LI.FI Earn API** for vault discovery & portfolio positions (proxied via server-side API routes)
- **LI.FI Composer API** for deposit/repair quotes & transaction execution

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── vaults/route.ts    # Proxy: LI.FI Earn vaults (server-side key)
│   │   ├── positions/route.ts # Proxy: Portfolio positions
│   │   ├── quote/route.ts     # Proxy: Composer quote
│   │   └── status/route.ts    # Proxy: Transaction status
│   ├── globals.css            # Design system (variables, cards, badges)
│   ├── layout.tsx             # Root layout with Inter font
│   ├── page.tsx               # Main app — state, tab routing
│   └── providers.tsx          # Client wrapper
├── components/
│   ├── Header.tsx             # Navigation + wallet button
│   ├── WalletButton.tsx       # Connect/disconnect wallet
│   ├── Dashboard.tsx          # Stats + policy summary + top policy-pass vaults
│   ├── VaultExplorer.tsx      # Vault list with filters/sort/search
│   ├── PolicyBuilder.tsx      # Policy editor (chains, protocols, thresholds)
│   ├── Portfolio.tsx          # Per-position violations + concentration-aware recommendations
│   ├── RepairFlow.tsx         # Repair/deposit modal with policy checks + approval + receipt polling
│   └── Activity.tsx           # Live transaction history (auto-refreshing)
├── lib/
│   ├── lifi-client.ts         # LI.FI API (server + client helpers, token normalization)
│   ├── policy-engine.ts       # Deterministic policy evaluation + concentration/idle-cash checks
│   ├── wallet.ts              # useWallet hook + getUsdcBalance + waitForTransactionReceipt
│   ├── store.ts               # localStorage persistence + updateTransactionStatus
│   └── utils.ts               # Formatting utilities
└── types/
    └── index.ts               # Type definitions (Position with assetDecimals/balanceAtomic)
```

## Policy Engine

Rules are **deterministic** — no AI:

| Rule | Violation | Warning |
|------|-----------|---------|
| Chain not allowed | ✗ Violating | — |
| Protocol not allowed | ✗ Violating | — |
| TVL below minimum | ✗ if < 90% threshold | ⚠ if 90-100% |
| APY below minimum | ✗ if < 90% threshold | ⚠ if 90-100% |
| Protocol concentration > max | ✗ if > 110% max | ⚠ if 100-110% |

### Pre-Deposit Policy Enforcement

Before a quote is requested, the engine runs real-time checks:

- **`wouldViolateConcentration(vault, amount, positions, policy)`** — blocks deposits/repairs that would push protocol exposure over the max. Applied to both repair and deposit flows.
- **`checkIdleCash(amount, walletBalance, policy, positions)`** — blocks deposits that would reduce idle USDC below the `minIdleCashPct` threshold. Uses real on-chain wallet USDC balance via `getUsdcBalance()`.
- **Per-position recommendations** — `findBestCompliantVault()` accepts the current portfolio and deposit amount, filtering out vaults that would create a new concentration violation after the move.

Dashboard shows "Top Policy-Pass Vaults" (rule-passing vaults) with an explicit disclaimer that concentration limits are checked at deposit time — it does **not** overclaim amount-aware safety without the data.

## Repair Flow

Unlike a simple deposit, the Repair flow:

1. Shows the **source violating position** with its specific violation messages and token metadata
2. Defaults amount from `balanceNative` (not USD value) for accurate token-unit display
3. Derives `fromAmount` using the position's **`balanceAtomic`** when available, otherwise converts via **`assetDecimals`** — only falls back to 6 decimals for plain USDC deposit flows
4. **Hard guard**: if a repair position lacks token metadata (no decimals, no atomic balance), the quote is blocked with: *"This position lacks token metadata needed for a safe repair quote"*
5. Runs **`wouldViolateConcentration()`** and **`checkIdleCash()`** before requesting a quote — blocked violations show "Blocked by Policy"
6. Checks and requests **ERC-20 token approval** (`eth_call` for allowance check, `approve()` if needed)
7. **Same-chain transactions**: polls `eth_getTransactionReceipt` every 3s until confirmed or failed
8. **Cross-chain transfers**: polls LI.FI status API every 5s for completion
9. Updates stored transaction records via `updateTransactionStatus(hash, status)` — Activity tab refreshes live

## Transaction Lifecycle

```
Deposit/Repair initiated
    ↓
Policy pre-checks (concentration + idle cash)
    ↓
LI.FI Composer quote
    ↓
ERC-20 approval (if needed)
    ↓
eth_sendTransaction
    ↓
┌─ Same-chain ──→ Poll eth_getTransactionReceipt ──→ confirmed / failed
└─ Cross-chain ──→ Poll LI.FI status API ──→ DONE / FAILED
    ↓
updateTransactionStatus() → Activity auto-refreshes
```

## LI.FI Integration

- **Earn API** (`earn.li.fi`): Vault discovery, portfolio positions (with `assetDecimals` and `balanceAtomic` extraction)
- **Composer API** (`li.quest`): Quote generation, transaction execution, status tracking
- Auth via `x-lifi-api-key` header — **server-side only** via Next.js API routes
- Client code calls `/api/vaults`, `/api/positions`, `/api/quote`, `/api/status`
- Position normalization handles missing decimals/atomic balances gracefully (defaults to `null`)

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `window.ethereum` instead of wagmi/viem | Eliminates ~3MB of bundle, drops compile from 2.9min to 25s |
| Server-side API key (`LIFI_API_KEY`) | LI.FI docs: "Never expose your x-lifi-api-key in client-side environments" |
| `assetDecimals` + `balanceAtomic` on Position | Quote amounts must use token units, not USD conversions — prevents wrong-decimal quote errors |
| Per-position vault recommendations | A single global "best vault" ignores concentration impact of moving each specific position |
| Pre-deposit policy blocks | Prevents creating new violations while fixing old ones |
| Same-chain receipt polling | Without it, same-chain txs stay "pending" forever in Activity |
