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
  console.log("Deploying BrewToken and CoffeeLoyalty contracts...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const initialSupply = ethers.parseUnits("1000000", 18);
  const rewardThreshold = Number(process.env.REWARD_THRESHOLD || 8);
  const rewardTokenAmount = ethers.parseUnits(process.env.REWARD_TOKEN_AMOUNT || "5", 18);

  const BrewToken = await ethers.getContractFactory("BrewToken");
  const brewToken = await BrewToken.deploy(initialSupply);
  await brewToken.waitForDeployment();
  const brewTokenAddress = await brewToken.getAddress();
  console.log("BrewToken deployed to:", brewTokenAddress);

  const CoffeeLoyalty = await ethers.getContractFactory("CoffeeLoyalty");
  const coffeeLoyalty = await CoffeeLoyalty.deploy(
    brewTokenAddress,
    rewardThreshold,
    rewardTokenAmount
  );
  await coffeeLoyalty.waitForDeployment();
  const coffeeLoyaltyAddress = await coffeeLoyalty.getAddress();
  console.log("CoffeeLoyalty deployed to:", coffeeLoyaltyAddress);

  const rpcHost = resolveLocalHost();
  const rpcUrl = `http://${rpcHost}:8545`;
  
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    brewTokenAddress,
    coffeeLoyaltyAddress,
    network: hre.network.name,
    chainId: Number(network.chainId),
    rpcUrl,
    nativeSymbol: DEFAULT_NATIVE_SYMBOL,
    deployer: deployer.address,
    rewardThreshold,
    rewardTokenAmount: rewardTokenAmount.toString(),
    timestamp: new Date().toISOString(),
  };
  
  const rootPath = path.join(__dirname, "../../deployment.json");
  fs.writeFileSync(rootPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment info saved to deployment.json");
  
  const envPath = path.join(__dirname, "../../frontend/.env.local");
  const envContent = `NEXT_PUBLIC_LOYALTY_ADDRESS=${coffeeLoyaltyAddress}
NEXT_PUBLIC_TOKEN_ADDRESS=${brewTokenAddress}
NEXT_PUBLIC_NETWORK=hardhat-localhost
NEXT_PUBLIC_RPC_URL=${rpcUrl}
NEXT_PUBLIC_CHAIN_ID=${HARDHAT_CHAIN_ID}
NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL=${DEFAULT_NATIVE_SYMBOL}
NEXT_PUBLIC_RPC_HOST=${rpcHost}
`;
  
  const frontendDir = path.join(__dirname, "../../frontend");
  if (!fs.existsSync(frontendDir)) {
    console.error("Frontend directory not found!");
    process.exit(1);
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log("✅ Frontend .env.local updated with contract addresses!");
  console.log(`ℹ️ RPC host for LAN testing: ${rpcHost} (RPC: ${rpcUrl})`);
  console.log("\n📋 Next steps:\n1. Restart your frontend server\n2. Refresh the browser\n3. Contracts are ready to use!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

