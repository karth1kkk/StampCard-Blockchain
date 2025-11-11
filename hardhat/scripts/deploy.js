const hre = require("hardhat");
const { ethers } = require("hardhat");

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
  
  // Save deployment info (optional - for reference)
  console.log("\nDeployment successful!");
  console.log("Network:", hre.network.name);
  console.log("Contract Address:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

