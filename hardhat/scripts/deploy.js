const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying BrewToken and CoffeeLoyalty contracts...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const initialSupply = ethers.parseUnits("1000000", 18);
  const rewardThreshold = 8;
  const rewardTokenAmount = ethers.parseUnits("5", 18);

  const BrewToken = await ethers.getContractFactory("BrewToken");
  const brewToken = await BrewToken.deploy(initialSupply);
  await brewToken.waitForDeployment();
  const brewTokenAddress = await brewToken.getAddress();
  console.log("BrewToken deployed at:", brewTokenAddress);

  const CoffeeLoyalty = await ethers.getContractFactory("CoffeeLoyalty");
  const coffeeLoyalty = await CoffeeLoyalty.deploy(
    brewTokenAddress,
    rewardThreshold,
    rewardTokenAmount
  );
  await coffeeLoyalty.waitForDeployment();
  const coffeeLoyaltyAddress = await coffeeLoyalty.getAddress();
  console.log("CoffeeLoyalty deployed at:", coffeeLoyaltyAddress);

  console.log("Deployment complete.");
}

main().catch((error) => {
    console.error(error);
  process.exitCode = 1;
  });
