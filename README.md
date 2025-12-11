# BrewToken Coffee Loyalty DApp

A blockchain-based coffee loyalty system using BrewToken (BWT) as an ERC-20 rewards currency. Customers buy drinks with BrewToken, earn stamps automatically on-chain, and unlock free coffees after every 8 purchases. Merchants manage rewards directly from the CoffeeLoyalty smart contract and track customer activity in real-time via Supabase.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Installation Guide](#installation-guide)
- [Environment Variables](#environment-variables)
- [Using the DApp](#using-the-dapp)
- [Troubleshooting](#troubleshooting)
- [Commands](#commands)
- [Project Structure](#project-structure)

## 🎯 Project Overview

### Core Concept

BrewToken replaces traditional paper stamp cards with a blockchain-based loyalty program:

- **Token-based payments** – customers pay for coffee with BrewToken (BWT)
- **Automatic stamp accrual** – each purchase adds a stamp directly on-chain via smart contract
- **Customer self-redemption** – only customers can redeem their own rewards (not the contract owner)
- **Voucher system** – rewards are redeemed as free drink vouchers (Flat White or Cappuccino)
- **Real-time analytics** – Supabase stores aggregated purchase/reward data for dashboards
- **Mobile-friendly** – optimized for MetaMask Mobile QR code scanning

### User Flows

**Customer Flow:**
1. Customer connects wallet and browses coffee menu
2. Selects a coffee and pays with BrewToken via wallet or QR code
3. CoffeeLoyalty contract automatically adds 1 stamp after payment
4. After 8 stamps, customer earns a free drink (pending reward)
5. Customer redeems their own reward and selects a voucher (Flat White or Cappuccino)
6. Voucher is automatically added to POS checkout as a free item
7. Customer can add other items and pay only for those (voucher item is free)

**Merchant Flow:**
1. Merchant logs in via Supabase Auth at `/pos`
2. Connects operator wallet (contract owner) for administrative functions
3. Enters customer wallet address and selects coffee items
4. Generates QR code or accepts wallet payment
5. Payment triggers automatic stamp recording on-chain
6. System syncs purchase data to Supabase
7. Merchant can view customer stamp cards and pending rewards
8. Merchant can fund the reward pool (contract or custom addresses)
9. Merchant processes voucher orders (free drinks from redeemed rewards)

## 🧱 System Architecture

### Smart Contracts

- **`BrewToken.sol`** – ERC-20 token contract (symbol `BWT`, 18 decimals)
- **`CoffeeLoyalty.sol`** – Main loyalty contract that handles:
  - `buyCoffee(customer, amount)` – processes payment and automatically adds 1 stamp
  - `recordStamp(customer)` – manually record a stamp (owner only)
  - `redeemReward(customer)` – redeem a free drink (customer or owner can call, but only for customer's own rewards)
  - `fundRewards(amount)` – fund the reward pool (owner only)

Key Events:
- `CoffeePurchased(customer, amount, timestamp)`
- `StampAdded(customer, stampBalance, pendingRewards)`
- `RewardEarned(customer, totalPendingRewards)`
- `RewardRedeemed(customer, remainingRewards, payoutAmount)`

### Backend & Database (Supabase)

**Tables:**
- `customers(wallet_address, email, created_at, updated_at)` – Customer information
- `orders(id, customer_wallet, items, total_bwt, tx_hash, block_number, status, merchant_email, metadata, created_at)` – Purchase records
- `stamps(customer_wallet, stamp_count, pending_rewards, reward_eligible, lifetime_stamps, reward_threshold, last_updated, last_order_id)` – Stamp tracking
- `reward_history(id, wallet_address, reward_amount_bwt, tx_hash, block_number, created_at)` – Reward redemption history
- `products(id, name, description, price, image, created_at, updated_at)` – Coffee menu items

**API Routes:**
- `POST /api/stamps` – Sync purchases from frontend to database
- `PATCH /api/stamps` – Record reward redemption (requires owner wallet)
- `GET /api/customers` – Fetch customer list with stamp data
- `GET /api/products` – Fetch coffee menu products
- `GET /api/transactions` – Fetch purchase and reward history
- `POST /api/merchant/register` – Register new merchant account (Supabase Auth)
- `POST /api/rewards/notify` – Send reward notification emails (optional)

### Frontend (Next.js + Tailwind)

**Main Components:**
- **Customer Dashboard** (`CustomerDashboard.js`) – Customer-facing interface with wallet connection, coffee menu, purchase button, stamp progress, and recent activity
- **POS Dashboard** (`POSDashboard.js`) – Merchant point-of-sale interface with order management, customer wallet input, payment processing, QR generation, customer list, and BWT balance displays
- **Customer List** (`CustomerList.js`) – Displays all customers with stamp cards, pending rewards, and redemption controls (customer-only redemption)
- **Voucher Selection Modal** (`VoucherSelectionModal.js`) – Allows customers to select their free drink (Flat White or Cappuccino) when redeeming rewards
- **Purchase History** (`PurchaseHistory.js`) – Transaction history viewer
- **Receipt Modal** (`ReceiptModal.js`) – Displays transaction receipts with voucher items shown as $0
- **Stamp Card** (`StampCard.js`) – Visual stamp card component showing progress
- **Fund Pool Modal** (`FundPoolModal.js`) – Transfer BWT tokens to contract or custom addresses

**Pages:**
- `/` – POS login page
- `/pos` – POS dashboard (requires Supabase Auth)
- `/merchant` – Merchant dashboard (requires Supabase Auth)
- `/merchant/register` – Merchant registration page

## 🚀 Installation Guide

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- MetaMask browser extension (and MetaMask Mobile for QR scans)
- Supabase project (for database)

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
This starts a local blockchain at `http://127.0.0.1:8545` (chain id `31337`). Keep it running.

### 3. Deploy Contracts
```bash
# In a new terminal
npm run hardhat:deploy:save
```
This compiles and deploys `BrewToken` and `CoffeeLoyalty`, then writes addresses to `frontend/.env.local`.

### 4. Set Up Supabase
1. Create a Supabase project
2. Run the SQL in `frontend/supabase-schema.sql` in your Supabase SQL Editor
3. Get your Supabase keys:
   - Go to **Project Settings** → **API** in your Supabase dashboard
   - Copy your **Project URL** and **anon/public key**
   - Copy your **service_role key** (keep this secret! It has admin access)
4. Add to `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   
   **Important:** 
   - The `service_role` key is required for listing merchant profiles from `auth.users`
   - Never expose this key in client-side code or commit it to git
   - The `.env.local` file is already in `.gitignore`

### 5. Run the Frontend
```bash
npm run frontend:dev
```
Visit `http://localhost:3000`

### 6. Configure MetaMask
- Network: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Symbol: `ETH`
- Import the deployer account from Hardhat for contract owner operations

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
NEXT_PUBLIC_MERCHANT_WALLET=0x...        # wallet that receives BrewToken payments
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...            # Required for listing merchant profiles
```

**Required for Profile Login:**
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key from Supabase dashboard (Project Settings → API). Required for the `/api/merchant/profiles` endpoint to list all merchants from `auth.users`.

**Optional:**
- `MERCHANT_REGISTRATION_SECRET` – Secret code for merchant registration (default: '31337')
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `REWARD_EMAIL_FROM` – For reward notification emails

## ☕ Using the DApp

### Customer Journey
1. Visit the customer dashboard (or merchant can generate QR codes)
2. Connect MetaMask wallet
3. Browse the coffee menu
4. Tap **Buy with MetaMask** on any item
5. Confirm the BrewToken transfer
6. Stamp is automatically added after transaction confirmation
7. At 8 stamps, customer earns a pending reward (free drink)

### Merchant / POS Journey
1. Visit `/` or `/pos` and sign in with Supabase Auth (or register at `/merchant/register`)
2. Connect the contract owner wallet (for administrative functions like funding pool)
3. Enter customer wallet address manually or scan QR code
4. Select coffee items and quantities
5. Choose payment method:
   - **Pay with Connected Wallet** – customer pays directly from connected wallet
   - **Complete Voucher Order** – for voucher-only orders (no payment needed)
6. After payment, stamp is automatically recorded on-chain
7. Purchase is synced to Supabase database
8. If customer reaches 8/8 stamps, a notification toast appears
9. Customers can redeem their own rewards (merchant cannot redeem for them)
10. When customer redeems, they select a voucher (Flat White or Cappuccino)
11. Voucher is automatically added to POS checkout as a free item
12. Merchant can fund the reward pool (contract or custom addresses) using the Fund Pool button
13. View BWT balances for both the loyalty contract and operator wallet in the sidebar

### Features
- **Automatic Stamp Recording** – Stamps are added on-chain after each purchase
- **Real-time Updates** – Customer list refreshes every 3 seconds to show latest stamp counts
- **Payment Processing Loader** – Full-screen loader during payment processing
- **Full Stamp Card Notification** – Toast notification when customer reaches 8/8 stamps with clickable link to view stamp card
- **Product Management** – Coffee menu stored in Supabase database (can be updated via SQL)
- **Customer Self-Redemption** – Only customers can redeem their own rewards (not the contract owner)
- **Voucher System** – Rewards are redeemed as free drink vouchers (Flat White or Cappuccino)
- **Voucher-Only Orders** – Process $0 orders for redeemed vouchers without blockchain transactions
- **BWT Balance Display** – Real-time BWT balance display for loyalty contract and operator wallet
- **Flexible Fund Pool** – Transfer BWT to contract address or any custom wallet address
- **Voucher Protection** – Voucher items cannot have quantity changed (fixed at 1 per redemption)
- **Receipt Integration** – Receipts show voucher items as $0/FREE with clear labeling

## 🧪 Testing & Verification

- `npm run test:all` – Runs Hardhat unit tests and Next.js lint
- `npm run hardhat:test` – Smart contract tests only
- `npm run sync:abi` – Regenerate `frontend/constants/*.json` ABIs after contract changes

## 🛠 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Cannot connect to the network localhost` | Hardhat node not running | Start `npm run hardhat:node` before deploying |
| `Internal JSON-RPC error` on purchase | Insufficient BWT balance or wrong approval | Transfer BWT to customer and approve spending |
| Customer data missing | Supabase not configured | Add Supabase env vars and restart frontend |
| Stamp count not updating | Database sync issue | Check API logs and verify on-chain state |
| Can't redeem reward | Wallet mismatch | Only customers can redeem their own rewards - connect the customer's wallet |
| Reward pool empty error | Contract needs BWT | Use Fund Pool button to transfer BWT to contract address |
| Voucher order fails | Missing address/txHash | Voucher orders don't require txHash - ensure address is provided |
| Balance not showing | Provider not connected | Ensure wallet is connected and provider is available |

## 🗂 Project Structure

```
StampCard-Blockchain/
├── hardhat/                              # Smart contracts
│   ├── contracts/
│   │   ├── BrewToken.sol                # ERC-20 token contract
│   │   └── CoffeeLoyalty.sol            # Loyalty program contract
│   ├── scripts/
│   │   ├── deploy.js                    # Basic deployment
│   │   ├── deploy-and-save.js           # Deployment with env sync
│   │   └── check-token.js               # Token utility
│   ├── test/
│   │   └── CoffeeLoyalty.test.js        # Contract tests
│   └── hardhat.config.js
│
├── frontend/                             # Next.js application
│   ├── components/
│   │   ├── CustomerDashboard.js         # Customer interface
│   │   ├── MerchantDashboard.js         # Merchant dashboard
│   │   ├── WalletConnect.js             # Wallet connection
│   │   ├── ConnectViaQR.js              # QR payment flow
│   │   └── pos/                         # POS components
│   │       ├── POSDashboard.js          # Main POS interface
│   │       ├── LoginPage.js             # Merchant login
│   │       ├── CustomerList.js          # Customer management
│   │       ├── PurchaseHistory.js       # Transaction history
│   │       ├── StampCard.js             # Stamp card UI
│   │       ├── QRModal.js               # QR code modal
│   │       ├── ReceiptModal.js          # Receipt display
│   │       ├── FundPoolModal.js         # Fund reward pool (contract or custom)
│   │       └── VoucherSelectionModal.js # Voucher selection (Flat White/Cappuccino)
│   ├── pages/
│   │   ├── _app.js                      # App wrapper
│   │   ├── index.js                     # POS home/login
│   │   ├── pos/index.js                 # POS dashboard
│   │   ├── merchant/
│   │   │   ├── index.js                 # Merchant dashboard
│   │   │   └── register.js              # Merchant registration
│   │   └── api/                         # API routes
│   │       ├── stamps.js                # Purchase/reward sync
│   │       ├── customers.js             # Customer data
│   │       ├── products.js              # Product menu
│   │       ├── transactions.js          # Transaction history
│   │       ├── merchant/
│   │       │   └── register.js          # Merchant registration API
│   │       └── rewards/
│   │           └── notify.js            # Email notifications
│   ├── lib/
│   │   ├── web3.js                      # Web3 utilities
│   │   ├── db.js                        # Supabase functions
│   │   ├── constants.js                 # App constants
│   │   ├── contractABI.js               # Contract ABIs
│   │   ├── supabaseBrowser.js           # Client Supabase
│   │   └── supabaseServer.js            # Server Supabase
│   ├── context/
│   │   └── WalletContext.js             # Wallet state
│   ├── hooks/
│   │   └── useInactivityTimer.js        # Session timeout
│   ├── constants/
│   │   ├── brewtoken.json               # BrewToken ABI
│   │   └── coffeeloyalty.json           # CoffeeLoyalty ABI
│   └── supabase-schema.sql              # Database schema
│
└── README.md
```

## 📦 Commands

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install all dependencies |
| `npm run hardhat:node` | Start local blockchain |
| `npm run hardhat:deploy:save` | Deploy contracts and sync env |
| `npm run hardhat:compile` | Compile contracts |
| `npm run hardhat:test` | Run contract tests |
| `npm run frontend:dev` | Start Next.js dev server |
| `npm run frontend:build` | Build production frontend |
| `npm run sync:abi` | Sync ABIs to frontend |
| `npm run lint` | Run ESLint |

---

Built with ❤️ using BrewToken, CoffeeLoyalty, Hardhat, Supabase, and Next.js. Enjoy your coffee! ☕
