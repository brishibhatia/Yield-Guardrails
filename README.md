# Yield Guardrails

**Policy-based stablecoin treasury management** — *"Stripe Radar for stablecoin yield allocations"*

> Not yield chasing. Not AI autopilot. **Policy-first treasury control** — deterministic rules that prevent bad allocations before they happen.

Built for the LI.FI DeFi Mullet Hackathon. Define treasury rules, discover LI.FI Earn vaults, detect policy violations, execute **cross-chain repairs** with full LI.FI route transparency, compare vaults with rich metadata, do direct deposits from the explorer, and verify portfolio state after every transaction — all in one flow.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your LI.FI API key

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Note**: First page load takes ~25s for webpack compile. After that it's instant (~130ms).

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

## 90-Second Demo Path

1. **Click 🎯 Demo** → Demo banner appears, dashboard shows 1 violation
2. **Dashboard** → See "Powered by LI.FI Earn" coverage strip showing chain/protocol/vault counts
3. **Vaults tab** → Toggle "Compare" checkbox, select 2-3 vaults, see side-by-side comparison (APY breakdown, 7d/30d trends, TVL, transactional status, policy compliance)
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
10. **Go back → Vaults tab → Click "Deposit" on a transactional vault** → Opens the same deposit flow (amount entry, policy checks, quote, execute)
11. **Try the "Aave V3 Base USDC" vault** (6.10% APY — highest!) → Watch the app **block it** with "concentration would exceed 40% max" (guardrails thesis in action)
12. **Policy tab** → Edit any rule to see positions instantly re-evaluate

## Six Key Features

### 1. Dynamic Chain + Protocol Coverage from LI.FI Earn

The app fetches live data from LI.FI's `/earn/chains` and `/earn/protocols` endpoints to show the true scale of LI.FI's infrastructure. A coverage strip on the Dashboard and Vault Explorer displays:
- Number of supported chains
- Number of integrated protocols
- Count of depositable vaults
- "Powered by LI.FI Earn" branding

### 2. Vault Comparison Mode with Rich Metadata

Toggle "Compare" in the Vault Explorer to select up to 4 vaults for side-by-side comparison:

| Field | Description |
|-------|-------------|
| Total APY | Combined base + reward |
| Base APY | Lending/liquidity yield |
| Reward APY | Token incentives |
| 7d / 30d APY | Historical trend data |
| Trend Badge | ▲ Improving / — Stable / ▼ Declining |
| TVL | Total value locked |
| Status | Depositable / View only |
| Policy | ✓ Compliant / ✗ Non-compliant |

Vaults are ranked by a deterministic **Policy Rank**: policy-compliant first → transactional first → higher APY → better APY stability → higher TVL. This ranking is explainable and consistent.

### 3. One-Click Direct Deposit from Explorer

Every transactional vault in the explorer shows a **Deposit** button. Clicking it opens the same modal used for repairs:
- Enter amount
- Run idle cash + concentration policy checks
- Get LI.FI quote with route transparency
- Execute with approval handling
- See after-state verification

Non-transactional vaults show a disabled "No deposit" button with tooltip explanation, preventing judges from hitting dead ends.

### 4. Real Portfolio Verification After Live Success

After a real transaction reaches confirmed/DONE:
- The app polls the LI.FI Earn portfolio positions endpoint (up to 3 attempts, 8s apart)
- Verifies the target position appears in the updated portfolio
- Shows verification status:
  - **"Verified by LI.FI Earn portfolio"** — position confirmed
  - **"Verifying via Earn API..."** — still polling
  - **"Transaction confirmed; verification pending"** — timeout, indexing may be delayed
- Demo mode clearly shows: **"Simulated in demo mode"**

### 5. ⛓ Cross-Chain Rescue via LI.FI

The primary demo moment: a violating position on Ethereum gets repaired into a compliant vault on Base. LI.FI orchestrates swap + bridge + deposit. In demo mode, this works without a real wallet.

### 6. Transactional/Depositable Status

Every vault clearly shows its deposit capability:
- **"Depositable"** badge (green) — can be used for deposits/repairs via LI.FI
- **"View only"** badge (red) — visible but not actionable
- Non-transactional vaults have disabled deposit buttons
- Comparison table includes status column

## 🔗 Route Transparency

Every quote preview shows exactly what LI.FI is doing:
- **Bridge/tool** (e.g., Stargate V2, Enso Finance)
- **Step-by-step route** with numbered stages
- **Gas and fee costs** as line items
- **Estimated duration**
- **Plain-English explanation** of the full flow

## Environment Variables

Create `.env.local` with:

```env
# LI.FI API Key — server-side only, never exposed to browser
LIFI_API_KEY=your-lifi-api-key-here
```

> The API key is only used server-side via Next.js API routes (`/api/vaults`, `/api/positions`, `/api/quote`, `/api/status`, `/api/chains`, `/api/protocols`). It is **never** shipped to the browser.

## Tech Stack

- **Next.js 16** (App Router, webpack mode)
- **TypeScript** with strict typing
- **Tailwind CSS v4** + custom design system
- **Wallet integration** via `window.ethereum` — zero external wallet dependencies
- **LI.FI Earn API** for vault discovery, portfolio positions, chain/protocol coverage
- **LI.FI Composer API** for deposit/repair quotes & transaction execution

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── chains/route.ts     # Proxy: LI.FI Earn chains
│   │   ├── protocols/route.ts  # Proxy: LI.FI Earn protocols
│   │   ├── vaults/route.ts     # Proxy: LI.FI Earn vaults
│   │   ├── positions/route.ts  # Proxy: Portfolio positions
│   │   ├── quote/route.ts      # Proxy: Composer quote
│   │   └── status/route.ts     # Proxy: Transaction status
│   ├── globals.css             # Design system
│   ├── layout.tsx              # Root layout with Inter font
│   ├── page.tsx                # Main app — state, tabs, demo mode, coverage fetch
│   └── providers.tsx           # Client wrapper
├── components/
│   ├── Header.tsx              # Navigation + demo toggle + wallet
│   ├── WalletButton.tsx        # Connect/disconnect wallet
│   ├── Dashboard.tsx           # Stats + coverage strip + policy summary + top vaults
│   ├── VaultExplorer.tsx       # Vault list with compare mode, policy-rank, APY trends, deposit CTAs
│   ├── PolicyBuilder.tsx       # Policy editor (chains, protocols, thresholds)
│   ├── Portfolio.tsx           # Per-position violations + cross-chain repair targets
│   ├── RepairFlow.tsx          # Deposit/repair modal: route transparency + delta + portfolio verification
│   └── Activity.tsx            # Live transaction history
├── lib/
│   ├── lifi-client.ts          # LI.FI API helpers + chains/protocols + route extraction
│   ├── policy-engine.ts        # Rule evaluation + simulateRepair + explainVaultCompliance
│   ├── wallet.ts               # useWallet + getUsdcBalance + waitForTransactionReceipt
│   ├── store.ts                # localStorage persistence + updateTransactionStatus
│   ├── demo-data.ts            # Seeded positions, vaults, policy for demo mode
│   └── utils.ts                # Formatting utilities
└── types/
    └── index.ts                # Position, Vault, Policy, RouteInfo types
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

- **`wouldViolateConcentration()`** — blocks deposits/repairs that would push protocol exposure over the max
- **`checkIdleCash()`** — blocks deposits that would reduce idle USDC below threshold
- **Per-position recommendations** — `findBestCompliantVault()` filters out vaults that would create new concentration violations

### Vault Ranking (Policy Rank)

Deterministic secondary ranking in the explorer:

1. **Policy-compliant first** — vaults passing all rules appear above non-compliant
2. **Transactional first** — depositable vaults above view-only
3. **Higher APY** — better yield
4. **Better APY stability** — lower variance between total/1d/7d/30d APY
5. **Higher TVL** — more liquidity

## LI.FI Integration Points

| Endpoint | Purpose | Proxy Route |
|----------|---------|-------------|
| `GET /v1/earn/chains` | Live chain coverage count | `/api/chains` |
| `GET /v1/earn/protocols` | Live protocol coverage count | `/api/protocols` |
| `GET /v1/earn/vaults` | Vault discovery with metadata | `/api/vaults` |
| `GET /v1/earn/portfolio/{addr}/positions` | Portfolio positions + verification | `/api/positions` |
| `GET /v1/quote` | Composer quote for deposit/repair | `/api/quote` |
| `GET /v1/status` | Cross-chain transaction tracking | `/api/status` |
| `GET /v1/tools` | Available bridges + exchanges | `/api/tools` |

Auth via `x-lifi-api-key` header — **server-side only** via Next.js API routes.

## Demo Mode vs Live Mode

| Feature | Demo Mode | Live Mode |
|---------|-----------|-----------|
| Positions | Seeded (4 positions) | From LI.FI Earn portfolio |
| Vaults | Seeded (8 vaults) | From LI.FI Earn API |
| Coverage stats | Live from LI.FI | Live from LI.FI |
| Quotes | Simulated | Real LI.FI Composer |
| Execution | Simulated lifecycle | Real on-chain transaction |
| Verification | "Simulated in demo mode" | Polls Earn portfolio API |
| Wallet | Not required | Required |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `window.ethereum` instead of wagmi/viem | Eliminates ~3MB of bundle, drops compile from 2.9min to 25s |
| Server-side API key (`LIFI_API_KEY`) | LI.FI docs: never expose key in client-side environments |
| Live chains/protocols API calls | Shows LI.FI's real scale to judges (60+ chains, 20+ protocols) |
| Policy Rank sort default | Judges immediately see the best compliant, depositable vaults first |
| Compare mode (up to 4 vaults) | Meaningful vault selection, not just "pick highest APY" |
| Transactional badge on every vault | No dead ends — judges know exactly what's actionable |
| Direct deposit from explorer | Judges don't need a violation to see the deposit flow |
| Portfolio verification polling | Honest about verification state, never falsely claims verified |
| Demo-mode simulated execution | Full flow works without wallet — no dead ends for judges |
| Deliberate blocked action in demo | Guardrails thesis in action — highest APY ≠ best choice |
| True move simulation (subtract + add) | Delta card is accurate, not hypothetical |
