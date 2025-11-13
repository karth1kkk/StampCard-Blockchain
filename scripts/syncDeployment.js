const fs = require('fs');
const path = require('path');
const os = require('os');

const deploymentPath = path.join(__dirname, '..', 'deployment.json');
const envPath = path.join(__dirname, '..', 'frontend', '.env.local');

const HARDHAT_CHAIN_ID = 31337;
const DEFAULT_NATIVE_SYMBOL = 'ETH';
const FALLBACK_HOST = '127.0.0.1';

const REQUIRED_KEYS = [
  'NEXT_PUBLIC_LOYALTY_ADDRESS',
  'NEXT_PUBLIC_TOKEN_ADDRESS',
  'NEXT_PUBLIC_NETWORK',
  'NEXT_PUBLIC_RPC_URL',
  'NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL',
];

function resolveLocalHost() {
  if (process.env.LOCAL_RPC_HOST) {
    return process.env.LOCAL_RPC_HOST;
  }

  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const details of iface || []) {
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }

  return FALLBACK_HOST;
}

function readDeployment() {
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`deployment.json not found at ${deploymentPath}. Run npm run hardhat:deploy:save first.`);
  }

  const json = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  if (!json.coffeeLoyaltyAddress || !json.brewTokenAddress) {
    throw new Error('deployment.json missing contract addresses');
  }

  const rpcUrl = json.rpcUrl || `http://${resolveLocalHost()}:8545`;

  return {
    coffeeLoyaltyAddress: json.coffeeLoyaltyAddress,
    brewTokenAddress: json.brewTokenAddress,
    network: json.network || 'localhost',
    rpcUrl,
    chainId: json.chainId ?? HARDHAT_CHAIN_ID,
    nativeSymbol: json.nativeSymbol || DEFAULT_NATIVE_SYMBOL,
    rpcHost: new URL(rpcUrl).hostname,
  };
}

function parseEnv(content) {
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .reduce((acc, line) => {
      const [key, ...rest] = line.split('=');
      if (key) {
        acc[key.trim()] = rest.join('=').trim();
      }
      return acc;
    }, {});
}

function serialiseEnv(envObject) {
  return Object.entries(envObject)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
    .concat('\n');
}

function main() {
  const deployment = readDeployment();
  let envValues = {};

  if (fs.existsSync(envPath)) {
    envValues = parseEnv(fs.readFileSync(envPath, 'utf8'));
  }

  envValues.NEXT_PUBLIC_LOYALTY_ADDRESS = deployment.coffeeLoyaltyAddress;
  envValues.NEXT_PUBLIC_TOKEN_ADDRESS = deployment.brewTokenAddress;
  envValues.NEXT_PUBLIC_NETWORK = deployment.network;
  envValues.NEXT_PUBLIC_RPC_URL = deployment.rpcUrl;
  envValues.NEXT_PUBLIC_CHAIN_ID = String(deployment.chainId);
  envValues.NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL =
    envValues.NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL || deployment.nativeSymbol;
  envValues.NEXT_PUBLIC_RPC_HOST = deployment.rpcHost;

  for (const key of REQUIRED_KEYS) {
    if (!envValues[key]) {
      throw new Error(`Failed to set required key ${key}.`);
    }
  }

  fs.writeFileSync(envPath, serialiseEnv(envValues));
  console.log(`✅ Synced deployment info to ${path.relative(process.cwd(), envPath)}`);
}

try {
  main();
} catch (error) {
  console.error('❌ syncDeployment failed:', error.message);
  process.exit(1);
}

