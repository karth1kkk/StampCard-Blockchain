const { Wallet } = require("ethers");
const fs = require("fs");

const NUM_WALLETS = process.env.NUM_WALLETS || 20;
const wallets = [];

for (let i = 0; i < NUM_WALLETS; i++) {
  const wallet = Wallet.createRandom();
  wallets.push({
    address: wallet.address,
    privateKey: wallet.privateKey,
  });
}

fs.writeFileSync("bulk-wallets.json", JSON.stringify(wallets, null, 2));
console.log(`✅ Generated ${NUM_WALLETS} wallets and saved to bulk-wallets.json`);

