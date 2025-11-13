# BrewToken Coffee Loyalty DApp

A full-stack coffee loyalty experience that replaces paper stamp cards with BrewToken (BWT), an ERC‑20 powered rewards currency. Customers buy drinks with BrewToken, earn stamps automatically, and unlock free coffees after every 8 purchases. Merchants control rewards directly from the CoffeeLoyalty smart contract and can review Supabase-backed analytics in real time.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Installation Guide](#installation-guide)
- [Environment Variables](#environment-variables)
- [Using the DApp](#using-the-dapp)
- [Troubleshooting](#troubleshooting)
- [Commands](#commands)
- [Project Structure](#project-structure)
- [Contributors](#contributors)

## 🎯 Project Overview

### Why BrewToken?

Traditional loyalty punch cards are easy to lose, simple to forge, and offer little visibility into customer behaviour. BrewToken solves this by:

- **Tokenised purchases** – customers pay for coffee with BrewToken (BWT).
- **Automatic stamp accrual** – each confirmed purchase adds a stamp directly on-chain.
- **Owner-verified rewards** – only the contract owner can redeem free drinks; no forged cards.
- **Real-time analytics** – Supabase stores aggregated purchase/reward data for dashboards.
- **Mobile-first UX** – the entire experience is optimised for MetaMask Mobile scans.

### End-to-End Flow

1. **Merchant prints QR codes** from the dashboard for each coffee item. The QR encodes price + metadata.
2. **Customer scans the QR** with MetaMask Mobile, reviews the BrewToken transfer, and confirms.
3. **CoffeeLoyalty contract** transfers BWT to the merchant and increments the customer’s stamp count.
4. **Supabase sync** records the purchase so dashboards stay in sync with on-chain events.
5. **After 8 stamps**, the merchant redeems a reward in-app; CoffeeLoyalty verifies ownership and optionally pays out BrewToken from the reward pool.

## 🧱 System Architecture

### Smart Contracts

- **`BrewToken.sol`** – ERC‑20 token (symbol `BWT`, 18 decimals). Deployments mint 1,000,000 BWT to the contract owner.
- **`CoffeeLoyalty.sol`** – tracks stamp counts, handles purchases (`buyCoffee`), owner-issued stamps (`addStamp`), reward redemptions, and reward pool funding.

Key events:
- `CoffeePurchased(customer, amount, timestamp)`
- `StampAdded(customer, stampBalance, pendingRewards)`
- `RewardEarned(customer, totalPendingRewards)`
- `RewardRedeemed(customer, remainingRewards, payoutAmount)`

### Backend & Database (Supabase)

Tables:
- `customers(wallet_address, stamp_count, pending_rewards, total_volume, last_purchase_at, …)`
- `purchase_history(wallet_address, product_id, product_name, price_bwt, tx_hash, block_number, outlet_id, metadata, …)`
- `reward_history(wallet_address, reward_amount_bwt, tx_hash, block_number, …)`
- `outlets(...)` (for QR metadata – optional).

API routes:
- `POST /api/stamps` – syncs purchases from the frontend.
- `PATCH /api/stamps` – merchant reward redemption (requires owner wallet signature).
- `GET /api/stamps?address=0x…` – fetches customer summary.
- `GET /api/customers?scope=all&owner=…&signature=…` – returns full customer list (owner-signed).
- `GET /api/transactions` – exposes purchase/reward history.

### Frontend (Next.js + Tailwind)

- **Customer Dashboard** – BrewToken balance, stamp progress, coffee catalogue (10 drinks), purchase button per item, recent activity.
- **Merchant Dashboard (owner only)** – customer list (stamps, rewards, volume), reward redemption, reward pool controls, QR generator.
- **QR Scanner** – mobile-optimised page that reads `BWT_PURCHASE` payloads and posts to `/api/stamps` after payment.

## 🚀 Installation Guide

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- MetaMask browser extension (and MetaMask Mobile for scans)
- Optional: Supabase project for persistence

### 1. Clone & Install
```bash
git clone <repository-url>
cd StampCard-Blockchain
npm run install:all
```

### 2. Start Hardhat Node
```bash
npm run hardhat:node
```
This exposes `http://127.0.0.1:8545` (chain id `31337`). Leave it running while you develop.

### 3. Deploy Contracts & Sync Env
```bash
# In a new terminal
defaultReward=5  # optional override
npm run hardhat:deploy:save
```
This compiles + deploys `BrewToken` and `CoffeeLoyalty`, then writes the addresses to `frontend/.env.local` (`NEXT_PUBLIC_LOYALTY_ADDRESS`, `NEXT_PUBLIC_TOKEN_ADDRESS`, etc.). If you see “Cannot connect to network localhost”, make sure `npm run hardhat:node` is running first.

### 4. Run the Frontend
```bash
npm run frontend:dev
```
Visit `http://localhost:3000`.

### 5. Configure MetaMask
- Network: `http://127.0.0.1:8545`, chain id `31337`, symbol `ETH`.
- Import the deployer key printed by Hardhat (`0x59c6…f7dec`) for owner operations.
- Import additional accounts for customer testing if needed.

### 6. Supabase Setup (optional but recommended)
1. Create a Supabase project.
2. Run the SQL in `frontend/supabase-schema.sql`.
3. Add to `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   ```
4. Restart the frontend dev server.

## 🔐 Environment Variables

`frontend/.env.local` (auto-generated by `hardhat:deploy:save`):
```env
NEXT_PUBLIC_LOYALTY_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_NETWORK=hardhat-localhost
NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL=ETH
NEXT_PUBLIC_REWARD_THRESHOLD=8
MERCHANT_ACCESS_MESSAGE=CoffeeLoyaltyMerchantAccess
```

Additional options:
- `MERCHANT_API_KEY` (legacy; replaced by owner signature flow).
- Supabase secrets listed above.

## ☕ Using the DApp

### Customer Journey
1. Connect MetaMask via the top-right button.
2. Browse the coffee grid, tap **Buy with MetaMask** on any item.
3. Confirm the BrewToken transfer; once mined, you’ll see a toast and your stamp count updates.
4. At 8 stamps, the dashboard highlights your free drink.
5. Alternatively, open **Scan & Pay** on a phone, scan the merchant’s QR, and approve the transfer.

### Merchant / Owner Journey
1. Connect the deployer wallet on `/merchant`.
2. Review live stats (stamp totals, pending rewards, reward pool balance).
3. Redeem free drinks by clicking **Redeem Reward** next to a customer (executes on-chain + posts to Supabase).
4. Fund the reward pool when required (pulls BWT from the owner wallet into CoffeeLoyalty).
5. Print QR codes for each coffee via the **Coffee Menu QR** module.

### Transaction History
The History tab aggregates purchases and reward redemptions from Supabase (wallet-specific if connected, global otherwise).

## 🧪 Testing & Verification

- `npm run test:all` – runs Hardhat unit tests (CoffeeLoyalty) and Next.js lint.
- `npm run hardhat:test` – smart contract tests only.
- `npm run sync:abi` – regenerate `frontend/constants/*.json` ABIs after contract changes.

## 🛠 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Cannot connect to the network localhost` | Hardhat node not running | Start `npm run hardhat:node` before deploying |
| `Internal JSON-RPC error` on purchase | Insufficient BWT balance or wrong approval | Transfer BWT to the customer and re-approve |
| Customer data missing | Supabase creds absent | Add Supabase env vars and restart frontend |
| Merchant API returns 401 | Owner signature missing or invalid | Click **Refresh Customers** while connected with the deployer wallet |

## 🗂 Project Structure

```
StampCard-Blockchain/
├── hardhat/                  # Solidity contracts, tests, deployment scripts
├── frontend/                 # Next.js application
│   ├── components/           # React UI components
│   ├── constants/            # Generated ABI + coffee menu data
│   ├── lib/                  # web3 + Supabase helpers
│   ├── pages/                # Next.js routes & API endpoints
│   └── supabase-schema.sql   # Database schema
├── scripts/                  # Node utilities (ABI & env sync)
├── deployment.json           # Last deployment metadata
└── README.md
```

## 📦 Commands

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install root + hardhat + frontend dependencies |
| `npm run hardhat:node` | Start local JSON-RPC node |
| `npm run hardhat:deploy:save` | Deploy BrewToken & CoffeeLoyalty + refresh env |
| `npm run hardhat:compile` | Compile Solidity contracts |
| `npm run hardhat:test` | Run contract tests |
| `npm run sync:abi` | Sync ABIs to `frontend/constants` |
| `npm run sync:deployment` | Copy deployment.json → frontend `.env.local` |
| `npm run frontend:dev` | Start Next.js dev server |
| `npm run frontend:build` / `frontend:start` | Build/serve production frontend |
| `npm run lint` | Run Next.js ESLint |
| `npm run test:all` | Contracts test + frontend lint |

## 👥 Contributors

| Name | Role |
|------|------|
| [Your Name] | Project Lead / Smart Contracts |
| [Teammate] | Frontend Developer |
| [Teammate] | Backend & Supabase |
| [Teammate] | UI/UX Designer |

> Update the table with your actual team members.

---

Built with ❤️ using BrewToken, CoffeeLoyalty, Hardhat, Supabase, and Next.js. Enjoy your coffee! ☕
