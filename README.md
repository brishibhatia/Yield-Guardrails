# Yield Guardrails

**Yield Guardrails turns treasury policy into enforceable rules, then uses LI.FI to repair non-compliant allocations in one click.**

**Track: Yield Builder**

> Not a yield optimizer. Not a treasury OS. Not AI autopilot. **Policy-first stablecoin treasury guardrails with one-click cross-chain repair.**

Built for the **LI.FI DeFi Mullet Hackathon**. The core workflow:

1. **Define** treasury rules (allowed chains, protocols, TVL minimums, APY floors, concentration limits)
2. **Detect** policy violations across existing portfolio positions
3. **Block** unsafe allocations *before* execution — not after
4. **Recommend** the best compliant vault target
5. **Repair** non-compliant positions via LI.FI Composer (cross-chain swap + bridge + deposit in one tx)
6. **Verify** the after-state via LI.FI Earn portfolio API

Every step is deterministic, explainable, and auditable. No AI. No black boxes.

🌐 **Live Demo**: [https://lifiproject.vercel.app](https://lifiproject.vercel.app)

🎬 **Demo Video**: [Watch on Google Drive](https://drive.google.com/file/d/1qa_WFMdpkUMVWYlFi4Wl809nCdMwbclU/view?usp=sharing)

**✅ Live-tested on Base mainnet** — real USDC deposit executed through LI.FI Composer, confirmed on-chain: [BaseScan tx](https://basescan.org/tx/0xa25532fa266cc6ebca7e576ab1bfea2ba515ea0c17020ef5a956e0006fdb69b6)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Demo Mode](#-demo-mode--no-wallet-required)
- [90-Second Demo Path](#90-second-demo-path)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Route Transparency](#-route-transparency)
- [Policy Engine](#policy-engine)
- [LI.FI Integration Points](#lifi-integration-points)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Demo Mode vs Live Mode](#demo-mode-vs-live-mode)
- [Tech Stack](#tech-stack)
- [Key Design Decisions](#key-design-decisions)
- [Live Testing Results](#live-testing-results)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your LI.FI API key (get one at https://portal.li.fi/)

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Note**: First page load takes ~25-40s for webpack compile. After that it's instant (~130ms).

---

## 🎯 Demo Mode — No Wallet Required

Click the **🎯 Demo** button in the header to instantly load a seeded treasury with:

- **1 violating position** (Yearn on Ethereum — protocol not allowed)
- **1 warning position** (APY near minimum threshold)
- **2 compliant positions** (all rules pass)
- **8 vaults** including a deliberate "concentration trap" (highest APY, but blocked by policy)

Judges can explore every tab, trigger repairs, compare vaults, see route details, see before/after deltas, and experience a blocked action — **all without connecting a wallet**.

### Demo Portfolio

| Position | Protocol | Chain | Value | Status |
|----------|----------|-------|-------|--------|
| yvUSDC | Yearn | Ethereum | $350,000 | ✗ **Violating** — protocol not allowed |
| USDC | Aave V3 | Arbitrum | $150,000 | ✓ **Compliant** |
| USDC | Compound V3 | Base | $300,000 | ⚠ **Warning** — APY 2.1% near 2.0% threshold |
| USDC | Aave V3 | Ethereum | $200,000 | ✓ **Compliant** |

**Policy**: Conservative Treasury — Chains: ETH/Base/Arb, Protocols: Aave V3/Compound V3/Morpho, Min TVL: $5M, Min APY: 2%, Max Exposure: 40%, Min Idle Cash: 10%

---

## 90-Second Demo Path

1. **Click 🎯 Demo** → Demo banner appears, dashboard shows 1 violation
2. **Dashboard** → See "Powered by LI.FI Earn" coverage strip showing live chain/protocol/vault counts
3. **Vaults tab** → Toggle "Compare" checkbox, select 2-3 vaults, see side-by-side comparison (APY breakdown, 1d/7d/30d trends, tags, TVL, transactional status, policy compliance)
4. **Portfolio tab** → See all 4 positions with color-coded violation/warning badges
5. **Click "⛓ Cross-Chain Repair →"** on the Yearn position → Repair modal opens
   - Header says **"⛓ Cross-Chain Repair"** with "Ethereum → Base via LI.FI"
6. **See the delta card**: Health 65 → 90, Violations 1 → 0, Yearn Exposure 35% → 0%
7. **See "Why this vault?"**: 5 green checkmarks confirming policy compliance
8. **Click "Get Quote"** → LI.FI route transparency panel:
   - Bridge/tool: Stargate V2
   - Route steps: Swap yvUSDC→USDC, Bridge ETH→Base
   - Gas cost, fee cost, estimated duration
   - Plain-English: *"LI.FI will swap yvUSDC to USDC on Ethereum, bridge it to Base via Stargate V2, then deposit into Morpho Blue USDC."*
9. **Click "Execute Cross-Chain Repair"** → Simulated execution → **Verified After-State** panel:
   - Health Score: 65/100 → 90/100 ✅
   - Violations: 1 → 0 ✅
   - Yearn Exposure: 35.0% → 0.0% ✅
   - Badges: "✓ Violations Reduced" • "✓ Policy Improved" • "✓ Exposure Reduced"
   - Label: *"Simulated in demo mode"*
10. **Go back → Vaults tab → Click "Deposit" on a transactional vault** → Opens the same deposit flow
11. **Try the "Aave V3 Base USDC" vault** (6.10% APY — highest!) → Watch the app **block it** with "concentration would exceed 40% max" (**guardrails thesis in action**)
12. **Policy tab** → Edit any rule, expand "Advanced Route Settings" to see LI.FI bridge/exchange controls

---

## Key Features

### 1. Dynamic Chain + Protocol Coverage from LI.FI Earn

The app fetches live data from LI.FI's `/earn/chains` and `/earn/protocols` endpoints to show the true scale of LI.FI's infrastructure. A coverage strip on the Dashboard and Vault Explorer displays:
- Number of supported chains (60+)
- Number of integrated protocols (20+)
- Count of depositable vaults
- "Powered by LI.FI Earn" branding

### 2. Vault Comparison Mode with Rich Intelligence

Toggle "Compare" in the Vault Explorer to select up to 4 vaults for side-by-side comparison:

| Field | Description |
|-------|-------------|
| Total APY | Combined base + reward |
| Base APY | Lending/liquidity yield |
| Reward APY | Token incentives |
| 1d APY | Last 24h APY when available |
| 7d / 30d APY | Historical trend data |
| Trend Badge | ▲ Improving / — Stable / ▼ Declining |
| Tags | stablecoin / single / il-risk when available |
| TVL | Total value locked |
| Status | Depositable / View only |
| Policy | ✓ Compliant / ✗ Non-compliant |

Vaults are ranked by a deterministic **Policy Rank**: policy-compliant first → transactional first → higher APY → better APY stability → higher TVL. This ranking is explainable and consistent.

### 3. Route Policy Controls

The Policy Builder includes an **Advanced Route Settings** panel that influences LI.FI quote generation:

| Control | Effect |
|---------|--------|
| Route Order | FASTEST vs CHEAPEST |
| Allowed Bridges | Restrict to specific bridges |
| Preferred Bridges | Suggest bridges when possible |
| Allowed Exchanges | Restrict to specific DEXs |
| Preferred Exchanges | Suggest DEXs when possible |

Bridge and exchange options are fetched live from LI.FI's `/v1/tools` endpoint via `/api/tools`. Selected preferences are passed through to every quote request.

### 4. One-Click Direct Deposit from Explorer

Every transactional vault in the explorer shows a **Deposit** button. Clicking it opens the deposit modal:
- Enter amount
- Run idle cash + concentration policy checks (pre-execution enforcement)
- Get LI.FI Composer quote with full route transparency
- ERC-20 approval handling (uses `quote.estimate.approvalAddress` per LI.FI docs)
- Execute on-chain via MetaMask
- See after-state verification

Non-transactional vaults show a disabled "No deposit" button with explanation, preventing dead ends.

### 5. Real Portfolio Verification After Live Success

After a real transaction reaches confirmed/DONE:
- The app polls the LI.FI Earn portfolio positions endpoint (up to 3 attempts, 8s apart)
- Verifies the **target position appears** in the updated portfolio
- Verifies the **source position is reduced or gone** (for repairs)
- Recomputes the health score from the refreshed portfolio when possible
- Shows granular verification status:
  - **"Verified by LI.FI Earn portfolio"** — both target and source confirmed
  - **"Target verified; source reduction pending"** — partial evidence
  - **"Verifying via Earn API..."** — still polling
  - **"Transaction confirmed; portfolio verification pending"** — timeout, indexing may be delayed
- Demo mode clearly shows: **"Simulated in demo mode"**

### 6. ⛓ Cross-Chain Rescue via LI.FI

The primary demo moment: a violating position on Ethereum gets repaired into a compliant vault on Base. LI.FI orchestrates swap + bridge + deposit in a single transaction. In demo mode, this works without a real wallet. In live mode, LI.FI Composer handles the full cross-chain route.

### 7. Transactional/Depositable Status

Every vault clearly shows its deposit capability:
- **"Depositable"** badge (green) — can be used for deposits/repairs via LI.FI Composer
- **"View only"** badge (red) — visible but not actionable
- Non-transactional vaults have disabled deposit buttons
- Comparison table includes status column

### 8. Smart Policy Enforcement

Pre-execution policy checks that prevent bad allocations:
- **Concentration check** — blocks deposits that would push a protocol over the max exposure limit
- **Idle cash check** — blocks deposits that would reduce wallet USDC below the minimum idle threshold
- **Small portfolio bypass** — portfolios under $100 skip concentration/idle checks (diversification doesn't apply at micro scale)
- **Per-position recommendations** — `findBestCompliantVault()` filters out vaults that would create new violations

### 9. Graceful Error Handling

- **MetaMask rejection** — shows "cancelled by user" and returns to input (not error state)
- **BigInt edge cases** — safely handles empty `"0x"` responses from allowance checks
- **API failures** — detailed error messages surfaced from LI.FI with response body logging
- **Chain switching** — automatically prompts MetaMask to switch chains when source ≠ wallet chain

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                          │
│  Dashboard │ Vault Explorer │ Portfolio │ Policy │ Activity     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Policy      │  Deterministic rules
                    │ Engine      │  (no AI, no ML)
                    └──────┬──────┘
                           │
              ┌────────────▼────────────────┐
              │    Next.js API Routes       │
              │  (server-side, key hidden)  │
              └────────────┬────────────────┘
                           │
         ┌─────────────────▼─────────────────────┐
         │           LI.FI Infrastructure         │
         │                                        │
         │  Earn API          Composer API         │
         │  • /earn/vaults    • /v1/quote          │
         │  • /earn/chains    • /v1/status         │
         │  • /earn/protocols • /v1/tools          │
         │  • /earn/portfolio                      │
         └────────────────────────────────────────┘
                           │
              ┌────────────▼────────────────┐
              │     On-Chain Execution      │
              │  MetaMask → EVM Chains      │
              │  (Ethereum, Base, Arbitrum)  │
              └─────────────────────────────┘
```

**Flow**: Define policy → Discover vaults (Earn) → Detect violations (Policy Engine) → Get quote (Composer) → Execute (MetaMask) → Verify (Earn Portfolio)

---

## 🔗 Route Transparency

Every quote preview shows exactly what LI.FI is doing:
- **Bridge/tool** (e.g., Stargate V2, Enso Finance, SushiSwap)
- **Step-by-step route** with numbered stages
- **Gas and fee costs** as line items
- **Estimated duration**
- **Plain-English explanation** of the full flow

Example: *"LI.FI will swap USDC to STEAKUSDC on Base via SushiSwap Aggregator, then deposit into Morpho STEAKUSDC vault."*

---

## Policy Engine

Rules are **deterministic** — no AI, no machine learning:

| Rule | Violation | Warning |
|------|-----------|---------|
| Chain not allowed | ✗ Violating | — |
| Protocol not allowed | ✗ Violating | — |
| TVL below minimum | ✗ if < 90% threshold | ⚠ if 90-100% |
| APY below minimum | ✗ if < 90% threshold | ⚠ if 90-100% |
| Protocol concentration > max | ✗ if > 110% max | ⚠ if 100-110% |

### Pre-Deposit Policy Enforcement

Before a quote is requested, the engine runs real-time checks:

- **`wouldViolateConcentration()`** — blocks deposits/repairs that would push protocol exposure over the max
- **`checkIdleCash()`** — blocks deposits that would reduce idle USDC below threshold
- **Small portfolio bypass** — portfolios under $100 skip concentration/idle checks
- **Per-position recommendations** — `findBestCompliantVault()` filters out vaults that would create new concentration violations

### Vault Ranking (Policy Rank)

Deterministic secondary ranking in the explorer:

1. **Policy-compliant first** — vaults passing all rules appear above non-compliant
2. **Transactional first** — depositable vaults above view-only
3. **Higher APY** — better yield
4. **Better APY stability** — lower variance between total/1d/7d/30d APY
5. **Higher TVL** — more liquidity

---

## LI.FI Integration Points

| # | Endpoint | Purpose | Proxy Route |
|---|----------|---------|-------------|
| 1 | `GET /v1/earn/chains` | Live chain coverage count + filter options | `/api/chains` |
| 2 | `GET /v1/earn/protocols` | Live protocol coverage count + filter options | `/api/protocols` |
| 3 | `GET /v1/earn/vaults` | Vault discovery with APY, TVL, tags, transactional status | `/api/vaults` |
| 4 | `GET /v1/earn/portfolio/{addr}/positions` | Portfolio positions + post-tx verification | `/api/positions` |
| 5 | `GET /v1/quote` | Composer quote for deposit/repair (swap + bridge + deposit) | `/api/quote` |
| 6 | `GET /v1/status` | Cross-chain transaction status tracking | `/api/status` |
| 7 | `GET /v1/tools` | Available bridges + exchanges for route policy controls | `/api/tools` |

All 7 endpoints are used. Auth via `x-lifi-api-key` header — **server-side only** via Next.js API routes. The API key is **never** exposed to the browser.

### How LI.FI Is Used in Each Flow

| Flow | LI.FI Endpoints Used |
|------|---------------------|
| Page load | `/earn/chains` + `/earn/protocols` + `/earn/vaults` |
| Connect wallet | `/earn/portfolio/{addr}/positions` |
| Vault explorer filtering | `/earn/vaults` (filtered by token) |
| Route settings | `/v1/tools` (bridges + exchanges) |
| Deposit / Repair quote | `/v1/quote` (Composer with `toToken = vault.address`) |
| Transaction tracking | `/v1/status` (cross-chain polling) |
| Post-tx verification | `/earn/portfolio/{addr}/positions` (up to 3 polls) |

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── chains/route.ts     # Proxy: LI.FI Earn chains
│   │   ├── protocols/route.ts  # Proxy: LI.FI Earn protocols
│   │   ├── vaults/route.ts     # Proxy: LI.FI Earn vaults (with client-side chain filtering)
│   │   ├── positions/route.ts  # Proxy: Portfolio positions
│   │   ├── quote/route.ts      # Proxy: Composer quote (POST)
│   │   ├── status/route.ts     # Proxy: Transaction status
│   │   └── tools/route.ts      # Proxy: LI.FI bridges + exchanges
│   ├── globals.css             # Design system (dark theme, glassmorphism)
│   ├── layout.tsx              # Root layout with Inter font
│   ├── page.tsx                # Main app — state, tabs, demo mode, live coverage fetch
│   └── providers.tsx           # Client wrapper
├── components/
│   ├── Header.tsx              # Navigation + demo toggle + wallet connect
│   ├── WalletButton.tsx        # Connect/disconnect wallet via window.ethereum
│   ├── Dashboard.tsx           # Stats + LI.FI coverage strip + policy summary + top vaults
│   ├── VaultExplorer.tsx       # Vault list with compare mode, policy-rank, APY trends, deposit CTAs
│   ├── PolicyBuilder.tsx       # Policy editor (chains, protocols, thresholds, route settings)
│   ├── Portfolio.tsx           # Per-position violations + cross-chain repair targets
│   ├── RepairFlow.tsx          # Deposit/repair modal: quote → route preview → approval → execute → verify
│   └── Activity.tsx            # Live transaction history with status badges
├── lib/
│   ├── lifi-client.ts          # LI.FI API helpers: Earn + Composer + route extraction + tools
│   ├── policy-engine.ts        # Rule evaluation + simulateRepair + concentration/idle checks
│   ├── wallet.ts               # useWallet hook + getUsdcBalance + waitForTransactionReceipt
│   ├── store.ts                # localStorage persistence for policy + transactions
│   ├── demo-data.ts            # Seeded positions, vaults, policy for demo mode
│   └── utils.ts                # Formatting utilities (USD, APY, chain names)
└── types/
    └── index.ts                # Position, Vault, Policy, RoutePreferences, RouteInfo, etc.
```

---

## Environment Variables

Create `.env.local` with:

```env
# LI.FI API Key — server-side only, never exposed to browser
# Get one at https://portal.li.fi/
LIFI_API_KEY=your-lifi-api-key-here

# Integrator identification (passed to LI.FI Composer quotes)
# Default: yield-guardrails
LIFI_INTEGRATOR=yield-guardrails

# Integrator fee (0 = no fee, 0.02 = 2%). Optional.
# Only applied when set. Not forced in demo mode.
# LIFI_FEE=0
```

> The API key is only used server-side via Next.js API routes. It is **never** shipped to the browser. The app works without an API key (lower rate limits), but one is recommended for reliable performance.

### Integrator-Ready

The app is integrator-ready: `LIFI_INTEGRATOR` and `LIFI_FEE` are read from environment variables and passed through on every LI.FI Composer quote request. Partners can set these to receive LI.FI revenue-share without code changes.

---

## Demo Mode vs Live Mode

| Feature | Demo Mode | Live Mode |
|---------|-----------|-----------|
| Positions | Seeded (4 positions, $1M portfolio) | From LI.FI Earn portfolio API |
| Vaults | Seeded (8 vaults with deliberate traps) | From LI.FI Earn vaults API (real data) |
| Coverage stats | Live from LI.FI | Live from LI.FI |
| Filters (chains/protocols) | Live from LI.FI (with fallbacks) | Live from LI.FI |
| Route settings (bridges/exchanges) | Live from LI.FI `/v1/tools` | Live from LI.FI `/v1/tools` |
| Quotes | Simulated (no real API call) | Real LI.FI Composer (`toToken = vault.address`) |
| Approval | Skipped | ERC-20 approval via `quote.estimate.approvalAddress` |
| Execution | Simulated lifecycle (no wallet needed) | Real on-chain transaction via MetaMask |
| Verification | "Simulated in demo mode" | Polls Earn portfolio, checks source + target |
| Wallet | Not required | Required (MetaMask or any injected provider) |
| Blocked actions | Concentration trap demonstrates guardrails | Real policy enforcement before every quote |

> **Demo mode** uses seeded positions and simulated quotes/execution to demonstrate the full user flow without requiring a wallet or real funds. Coverage stats, chain/protocol filters, and bridge/exchange tool lists are always fetched **live from LI.FI** regardless of mode.

---

## Tech Stack

- **Next.js 16** (App Router, webpack mode)
- **TypeScript** with strict typing
- **Tailwind CSS v4** + custom dark theme design system
- **Wallet integration** via `window.ethereum` — zero external wallet dependencies (no wagmi, no viem)
- **LI.FI Earn API** for vault discovery, portfolio positions, chain/protocol coverage, tools
- **LI.FI Composer API** for deposit/repair quotes & on-chain transaction execution

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `window.ethereum` instead of wagmi/viem | Eliminates ~3MB of bundle, drops compile from 2.9min to 25s |
| Server-side API key (`LIFI_API_KEY`) | LI.FI docs: never expose key in client-side environments |
| `toToken = vault.address` in quotes | Per LI.FI Earn docs: Composer deposits into vault when toToken is the vault contract |
| `toAddress = fromAddress` | Per LI.FI quote API docs: self-deposit pattern |
| `quote.estimate.approvalAddress` for approvals | Per LI.FI approval docs: never hardcode spender address |
| Live chains/protocols API calls | Shows LI.FI's real scale to judges (60+ chains, 20+ protocols) |
| Policy Rank sort default | Judges immediately see the best compliant, depositable vaults first |
| Compare mode (up to 4 vaults) | Meaningful vault selection, not just "pick highest APY" |
| Transactional badge on every vault | No dead ends — judges know exactly what's actionable |
| Direct deposit from explorer | Judges don't need a violation to see the deposit flow |
| Portfolio verification polling | Honest about verification state, never falsely claims verified |
| Demo-mode simulated execution | Full flow works without wallet — no dead ends for judges |
| Deliberate blocked action in demo | Guardrails thesis in action — highest APY ≠ best choice |
| True move simulation (subtract + add) | Delta card is accurate, not hypothetical |
| Route preferences wired to quotes | Policy controls directly influence LI.FI route generation |
| Integrator env vars (`LIFI_INTEGRATOR`, `LIFI_FEE`) | Partners can configure revenue-share without code changes |
| Small portfolio concentration bypass | Portfolios under $100 skip diversification checks (impractical at micro scale) |
| Graceful MetaMask rejection handling | User cancellation returns to input state, not error state |

---

## Live Testing Results

The application has been live-tested on **Base mainnet**:

| Test | Result |
|------|--------|
| Vault discovery from LI.FI Earn | ✅ Real USDC vaults loaded from Base, Ethereum, Arbitrum |
| Policy evaluation on live vaults | ✅ Compliance checks run correctly against real vault data |
| Quote from LI.FI Composer | ✅ Real quote returned with route, gas, and fee details |
| ERC-20 approval via MetaMask | ✅ USDC approval sent and confirmed |
| On-chain deposit execution | ✅ Real USDC deposited into Morpho vault on Base |
| Transaction confirmed on BaseScan | ✅ [View on BaseScan](https://basescan.org/tx/0xa25532fa266cc6ebca7e576ab1bfea2ba515ea0c17020ef5a956e0006fdb69b6) |
| Portfolio verification | ⏳ LI.FI Earn indexer updates asynchronously (normal behavior) |

### Build Status

```
✅ npm run build  — Compiled successfully (Next.js 16.2.3, webpack)
✅ npm run lint   — 0 errors, 0 warnings
✅ TypeScript     — Strict mode, no type errors
```

---

## What Makes This Different

Most projects in this space optimize for yield selection or treasury operations. **Yield Guardrails is not a yield optimizer** — it's a policy enforcement layer that sits *before* execution.

Based on the available builder and market data, very few products combine this full workflow:

| Step | What Happens | Why It Matters |
|------|-------------|----------------|
| 1. **Detect** | Scan portfolio for policy violations | Visibility into non-compliance |
| 2. **Explain** | Show *why* each position violates policy | Auditable, not a black box |
| 3. **Block** | Prevent unsafe deposits pre-execution | Guardrails, not guardsuggest |
| 4. **Recommend** | Suggest best compliant vault target | Policy-ranked, not APY-ranked |
| 5. **Repair** | Execute cross-chain fix via LI.FI Composer | One-click swap + bridge + deposit |
| 6. **Verify** | Confirm after-state via Earn portfolio API | Honest, never fakes results |

### Where This Sits in the Landscape

| Existing Tool | What It Does | What Yield Guardrails Adds |
|---------------|-------------|---------------------------|
| Fireblocks Treasury | Governance/policy controls | **Pre-execution blocking** + cross-chain repair |
| Exponential Risk Ratings | DeFi risk scoring | **Actionable enforcement**, not just scores |
| Summer.fi Earn | Self-custody yield vaults | **Policy layer** that prevents bad allocations |
| Generic yield dashboards | Show highest APY | **Block** highest APY when it violates policy |

### Positioning

- ❌ Don't call it: "yield optimizer" / "treasury OS" / "cross-chain vault aggregator"
- ✅ What it is: **"Policy-first stablecoin treasury guardrails with one-click cross-chain repair via LI.FI"**

> *"The best trade is the one you don't make."* — Yield Guardrails blocks the high-APY vault that would breach your concentration limit. That's the product.

### Key Differentiators

1. **Pre-execution, not post-mortem** — Violations are caught and blocked *before* the on-chain transaction
2. **Deterministic, not AI** — Every rule is explainable, auditable, and configurable
3. **Cross-chain repair in one click** — LI.FI Composer handles swap + bridge + deposit atomically
4. **Full route transparency** — Users see exactly which bridges, DEXs, and steps LI.FI uses
5. **Honest verification** — Never fakes a result; clearly labels demo vs live, verified vs pending
6. **Deliberate guardrails demo** — The app intentionally blocks the highest-APY vault to prove the thesis
