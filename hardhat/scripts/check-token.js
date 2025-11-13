const hre = require('hardhat');

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS || process.env.NEXT_PUBLIC_TOKEN_ADDRESS || process.env.BREW_TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('Set TOKEN_ADDRESS env var to inspect BrewToken.');
  }
  const token = await hre.ethers.getContractAt('BrewToken', tokenAddress);
  const symbol = await token.symbol();
  const name = await token.name();
  const supply = await token.totalSupply();
  console.log(`Token ${name} (${symbol}) total supply ${hre.ethers.formatUnits(supply, 18)} BWT`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

