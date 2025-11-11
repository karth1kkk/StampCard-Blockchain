# Blockchain Loyalty Stamp Card DApp

A decentralized application (DApp) that revolutionizes traditional loyalty stamp cards by leveraging blockchain technology. This system replaces physical stamp cards with digital blockchain tokens, providing transparency, security, and fraud-proof transactions.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Installation Guide](#installation-guide)
- [Features](#features)
- [Folder Structure](#folder-structure)
- [Commands](#commands)
- [Contributors](#contributors)

## 🎯 Project Overview

### Problem Statement

Traditional loyalty stamp card systems face several critical issues:

- **Physical Cards**: Easy to lose, damage, or forget
- **Fraud Susceptibility**: Stamps can be forged, duplicated, or tampered with
- **Lack of Transparency**: Customers cannot verify their stamp count or reward status
- **No Cross-Outlet Support**: Cards are usually tied to a single business
- **Manual Tracking**: Businesses must manually track customer stamps and rewards
- **Limited Analytics**: Difficult to gather insights on customer behavior

### Blockchain-Based Solution

Our solution leverages blockchain technology to address these challenges:

- **Digital Tokens**: Stamps are represented as ERC-1155 tokens on the blockchain
- **Immutable Records**: All transactions are recorded on-chain, making fraud impossible
- **Transparent & Verifiable**: Customers can view their stamp history and rewards in real-time
- **Decentralized**: No single point of failure, accessible from anywhere
- **Automatic Rewards**: Smart contracts automatically grant rewards when conditions are met
- **Multi-Outlet Support**: Customers can use stamps across different outlets (future enhancement)
- **Cost-Effective**: Eliminates printing and distribution costs

### How It Works

1. **Customer Makes a Purchase**: Merchant issues a digital stamp (ERC-1155 token) to the customer's wallet
2. **Automatic Tracking**: The smart contract tracks stamp count and automatically grants rewards
3. **Reward Redemption**: When a customer collects 8 stamps, they receive 1 reward token
4. **Transparent History**: All transactions are recorded on-chain and visible to customers
5. **Redemption**: Customers can redeem rewards at any participating outlet

## 🛠 Tech Stack

### Smart Contracts & Blockchain
- **Hardhat**: Development environment for Ethereum smart contracts
- **Solidity**: Smart contract programming language (v0.8.20)
- **OpenZeppelin**: Battle-tested smart contract libraries (ERC-1155, Ownable)
- **Ethers.js**: JavaScript library for interacting with Ethereum blockchain

### Frontend
- **Next.js**: React framework for production-ready applications
- **React**: UI library for building user interfaces
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **React Toastify**: Notification system for user feedback

### Blockchain Integration
- **MetaMask**: Web3 wallet for browser-based blockchain interactions
- **Ethers.js v6**: Modern Ethereum JavaScript library

### Database & Off-Chain Storage
- **Supabase**: Cloud-based PostgreSQL database for customer names, outlet info, and transaction history

### Testing & Development
- **Chai/Mocha**: Testing framework for smart contract testing
- **Hardhat Network**: Local blockchain network for development and testing

## 📦 Installation Guide

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask browser extension
- Git

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd StampCard-Blockchain
```

### Step 2: Install Dependencies

Install dependencies for both Hardhat and Frontend:

```bash
npm run install:all
```

Or install separately:

```bash
# Install Hardhat dependencies
npm run install:hardhat

# Install Frontend dependencies
npm run install:frontend
```

### Step 3: Start the Local Blockchain & Deploy the Contract

> You’ll typically keep three terminals open during development.

**Terminal 1 – Hardhat node (keep running)**
```bash
npm run hardhat:node
```
This boots a local JSON-RPC endpoint at `http://127.0.0.1:8545` (chain id `1337`).

**Terminal 2 – Compile and deploy**
```bash
npm run hardhat:compile
npm run hardhat:deploy:save
```
`deploy:save` deploys the `StampCard` contract and writes the latest address, RPC URL, chain id, and native token symbol to `frontend/.env.local`.

**Terminal 3 – Next.js frontend (keep running)**
```bash
npm run frontend:dev
```

### Step 4: Configure Environment Variables

If you use `npm run hardhat:deploy:save`, the file `frontend/.env.local` is generated automatically with defaults such as:
```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_NETWORK=localhost
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=1337
NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL=ETH
```
Editing `.env.local` requires a restart of the frontend dev server because Next.js only reads environment variables on startup.

### Step 5: Configure MetaMask

1. Install the MetaMask browser extension.
2. Add the Hardhat local network:
   ```
   Network Name: Hardhat Local
   RPC URL:      http://127.0.0.1:8545
   Chain ID:     1337
   Currency:     ETH
   ```
3. Import one of the private keys printed by `npm run hardhat:node` so the wallet has test ETH/MATIC.

### Step 6: Connect Wallet and Test

1. Visit [http://localhost:3000](http://localhost:3000).
2. Click **Connect Wallet** and approve the MetaMask prompt.
3. Explore the Customer and Merchant dashboards to confirm the contract connection.

## Quick Start Checklist

| Terminal | Command                         | Keep Running? | Notes                                |
|----------|---------------------------------|---------------|--------------------------------------|
| 1        | `npm run hardhat:node`          | ✅            | Local blockchain (chain id 1337)     |
| 2        | `npm run hardhat:deploy:save`   | ❌            | Deploys & auto-writes `.env.local`   |
| 3        | `npm run frontend:dev`          | ✅            | Next.js dev server (`http://localhost:3000`) |

Restart Terminal 3 whenever you edit environment variables, then perform a hard refresh in the browser (`Cmd/Ctrl + Shift + R`) to clear cached values.

---

## Deploying to Polygon Amoy

1. **Set environment variables** in `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_CONTRACT_ADDRESS=<Amoy contract address>
   NEXT_PUBLIC_NETWORK=polygon-amoy
   NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology
   NEXT_PUBLIC_CHAIN_ID=80002
   NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL=MATIC
   ```
2. **Deploy with Hardhat** (after adding credentials to `hardhat/.env` and configuring `hardhat.config.js`):
   ```bash
    npx hardhat run scripts/deploy.js --network polygonAmoy
   ```
3. **Fund your wallet** via [Polygon’s faucet](https://faucet.polygon.technology) and ensure MetaMask is set to the Polygon Amoy network (chain id 80002).
4. Restart the frontend to load the new variables. The UI automatically swaps all currency labels to the value provided in `NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL`.

---

## Supabase Integration (Optional)

1. Create a project at [supabase.com](https://supabase.com) and copy the Project URL + anon key (Settings → API).
2. Execute the schema in the SQL editor (same SQL snippet earlier in this README).
3. Add to `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Restart the frontend. Customer metadata and transaction history will now sync with Supabase.

---

## Using the DApp

### Customer View
- Monitor stamp totals, progress toward the next reward, and overall reward balance.
- Scan merchant QR codes to populate payment details, then authorize the transfer in MetaMask.
- Redeem rewards directly; the button disables itself when no rewards remain.

### Merchant View (Contract Owner)
- Scan customer QR codes and issue stamps from the `Merchant Dashboard`.
- Review analytics: total stamps, rewards granted, and unique customer count.
- Only the contract owner can issue stamps; other accounts see an authorization warning.

### Transaction History
- Displays `StampIssued`, `RewardGranted`, and `RewardRedeemed` events for the connected wallet along with quick explorer links.

---

## Project Structure

```
StampCard-Blockchain/
├── hardhat/        # Smart contracts, tests, deployment scripts
├── frontend/       # Next.js app, components, API routes, styles
├── scripts/        # Shared tooling (ABI sync, etc.)
├── deployment.json # Latest deployment info (auto-generated)
└── README.md
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Contract not deployed. Owner check skipped.` | Frontend still using cached env vars. | Restart `npm run frontend:dev`, hard refresh the browser. |
| `could not decode result data (value="0x")` | Wrong contract address or wrong network. | Redeploy, ensure Hardhat node is running, verify `.env.local`, restart frontend. |
| Gas estimation fails / `Internal JSON-RPC error` | Amount left blank or wallet has no funds. | Enter a non-zero amount and ensure the sender has native tokens. |
| Contract address keeps changing | Hardhat node restarted. | Keep the node running, or rerun `npm run hardhat:deploy:save` after each restart. |
| MetaMask can't connect | Wrong network or locked wallet. | Switch to the correct network (Hardhat Local / Polygon Amoy) and reconnect. |

If issues persist, clear Next.js cache (`rm -rf frontend/.next`), redeploy the contract, and restart all terminals in order.

---

## Why the Contract Address Changes Locally

Hardhat resets its state whenever you stop the node. Contract addresses are derived from the deployer address + nonce, so a fresh chain produces a new address. Recommended workflow:

1. Start `npm run hardhat:node` once and keep it running.
2. Deploy with `npm run hardhat:deploy:save`.
3. Restart the frontend to pick up the new `.env.local`.

If you intentionally restart the node, repeat these steps to update the address everywhere.

---

## 🚀 Commands

### Root Level (Convenience Scripts)

```bash
# Install all dependencies
npm run install:all

# Install Hardhat dependencies only
npm run install:hardhat

# Install Frontend dependencies only
npm run install:frontend

# Sync contract ABI from Hardhat to Frontend
npm run sync:abi

# Compile contracts and sync ABI
npm run hardhat:compile

# Run contract tests
npm run hardhat:test

# Start Hardhat local node
npm run hardhat:node

# Deploy contract to local network and update frontend env file
npm run hardhat:deploy:save

# Start Next.js development server
npm run frontend:dev

# Build Next.js for production
npm run frontend:build

# Start Next.js production server
npm run frontend:start
```

### Hardhat Commands

```bash
cd hardhat

# Compile smart contracts
npx hardhat compile

# Run tests
npx hardhat test

# Start local Hardhat node
npx hardhat node

# Deploy contract to localhost
npx hardhat run scripts/deploy.js --network localhost

# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network polygonAmoy
```

### Frontend Commands

```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

## 👥 Contributors

### Group Members

| Name | TP Number | Role |
|------|-----------|------|
| [Your Name] | [Your TP] | Project Lead / Developer |
| [Member 2] | [TP] | Smart Contract Developer |
| [Member 3] | [TP] | Frontend Developer |
| [Member 4] | [TP] | UI/UX Designer |
| [Member 5] | [TP] | Testing & QA |

**Note**: Please update the contributors table with your actual group member names and TP numbers.

## 📄 License

This project is licensed under the MIT License.

## 🔗 Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Ethers.js Documentation](https://docs.ethers.io)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [MetaMask Documentation](https://docs.metamask.io)
- [Supabase Documentation](https://supabase.com/docs) (if using Supabase)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Built with ❤️ using Hardhat, Next.js, and Ethereum**
