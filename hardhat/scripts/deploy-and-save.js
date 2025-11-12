const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HARDHAT_CHAIN_ID = 31337;
const DEFAULT_NATIVE_SYMBOL = "ETH";
const FALLBACK_HOST = "127.0.0.1";

const resolveLocalHost = () => {
  if (process.env.LOCAL_RPC_HOST) {
    return process.env.LOCAL_RPC_HOST;
  }

  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const details of iface || []) {
      if (details.family === "IPv4" && !details.internal) {
        return details.address;
      }
    }
  }

  return FALLBACK_HOST;
};

async function main() {
  console.log("Deploying StampCard contract...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
  
  // Deploy the contract
  const StampCard = await ethers.getContractFactory("StampCard");
  const stampCard = await StampCard.deploy(8);
  
  await stampCard.waitForDeployment();
  const address = await stampCard.getAddress();
  
  console.log("StampCard deployed to:", address);
  console.log("Contract owner:", await stampCard.owner());
  console.log("Reward threshold:", await stampCard.rewardThreshold());

  const rpcHost = resolveLocalHost();
  const rpcUrl = `http://${rpcHost}:8545`;
  
  // Save deployment info to file
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    address: address,
    network: hre.network.name,
    chainId: Number(network.chainId), // Convert BigInt to number
    rpcUrl,
    nativeSymbol: DEFAULT_NATIVE_SYMBOL,
    deployer: deployer.address,
    rewardThreshold: Number(await stampCard.rewardThreshold()),
    timestamp: new Date().toISOString()
  };
  
  // Save to root directory
  const rootPath = path.join(__dirname, '../../deployment.json');
  fs.writeFileSync(rootPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment info saved to deployment.json");
  
  // Update frontend .env.local
  const envPath = path.join(__dirname, '../../frontend/.env.local');
  const envContent = `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}
NEXT_PUBLIC_NETWORK=hardhat-localhost
NEXT_PUBLIC_RPC_URL=${rpcUrl}
NEXT_PUBLIC_CHAIN_ID=${HARDHAT_CHAIN_ID}
NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL=${DEFAULT_NATIVE_SYMBOL}
NEXT_PUBLIC_RPC_HOST=${rpcHost}
`;
  
  // Ensure frontend directory exists
  const frontendDir = path.join(__dirname, '../../frontend');
  if (!fs.existsSync(frontendDir)) {
    console.error("Frontend directory not found!");
    process.exit(1);
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log("✅ Frontend .env.local updated with contract address!");
  console.log(`ℹ️ RPC host for LAN testing: ${rpcHost} (RPC: ${rpcUrl})`);
  console.log("\n📋 Next steps:");
  console.log("1. Restart your frontend server (Ctrl+C then npm run dev)");
  console.log("2. Refresh your browser");
  console.log("3. The contract address has been automatically configured!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

