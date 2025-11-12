const { ethers } = require("ethers");
const fs = require("fs");

const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY;
const AMOUNT = process.env.FUND_AMOUNT || "0.5";
const MAX_TX = Number(process.env.MAX_TX || 20);

if (!FUNDING_PRIVATE_KEY) {
  console.error("❌ Missing FUNDING_PRIVATE_KEY in environment variables.");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC);
const funder = new ethers.Wallet(FUNDING_PRIVATE_KEY, provider);
const wallets = JSON.parse(fs.readFileSync("bulk-wallets.json", "utf8"));

(async () => {
  console.log(`🚀 Funding ${wallets.length} wallets from ${funder.address}...`);
  const balance = await provider.getBalance(funder.address);
  console.log(`Current balance: ${ethers.formatEther(balance)} POL`);

  let nonce = await provider.getTransactionCount(funder.address, "latest");

  for (let i = 0; i < wallets.length && i < MAX_TX; i++) {
    const w = wallets[i];
    const tx = await funder.sendTransaction({
      to: w.address,
      value: ethers.parseEther(AMOUNT),
      nonce: nonce++,
    });
    await tx.wait();
    console.log(`✅ Funded ${w.address} with ${AMOUNT} POL | tx: ${tx.hash}`);
  }
})();

