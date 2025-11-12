const { Wallet } = require("ethers");
require("@nomicfoundation/hardhat-toolbox");

const DEFAULT_BALANCE = "1000000000000000000000";
const DEFAULT_OWNER_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f094538b6a520438d93f8593b233c36ff23f7dec";
const DEFAULT_MERCHANT_PRIVATE_KEY =
  "0x8b3a350cf5c34c5edfd2832f440b1046dce476fff58726f0b00057d95f4b5bad";

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || DEFAULT_OWNER_PRIVATE_KEY;
const MERCHANT_PRIVATE_KEY = process.env.MERCHANT_PRIVATE_KEY || DEFAULT_MERCHANT_PRIVATE_KEY;

const additionalAccounts = Array.from({ length: 18 }).map(() => ({
  privateKey: Wallet.createRandom().privateKey,
  balance: DEFAULT_BALANCE,
}));

const hardhatAccounts = [
  { privateKey: OWNER_PRIVATE_KEY, balance: DEFAULT_BALANCE },
  { privateKey: MERCHANT_PRIVATE_KEY, balance: DEFAULT_BALANCE },
  ...additionalAccounts,
];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: hardhatAccounts,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    polygonMumbai: {
      url: process.env.POLYGON_MUMBAI_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80001,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

