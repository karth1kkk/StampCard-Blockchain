const fs = require('fs');
const path = require('path');

const deploymentPath = path.join(__dirname, '..', 'deployment.json');
const envPath = path.join(__dirname, '..', 'frontend', '.env.local');

const REQUIRED_KEYS = [
  'NEXT_PUBLIC_CONTRACT_ADDRESS',
  'NEXT_PUBLIC_NETWORK',
  'NEXT_PUBLIC_RPC_URL',
  'NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL',
];

function readDeployment() {
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`deployment.json not found at ${deploymentPath}. Run npm run hardhat:deploy:save first.`);
  }

  const json = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  if (!json.address) {
    throw new Error('deployment.json missing contract address');
  }

  return {
    address: json.address,
    network: json.network || 'localhost',
    rpcUrl: json.rpcUrl || 'http://127.0.0.1:8545',
    chainId: json.chainId ?? 1337,
    nativeSymbol: json.nativeSymbol || 'ETH',
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

  envValues.NEXT_PUBLIC_CONTRACT_ADDRESS = deployment.address;
  envValues.NEXT_PUBLIC_NETWORK = deployment.network;
  envValues.NEXT_PUBLIC_RPC_URL = envValues.NEXT_PUBLIC_RPC_URL || deployment.rpcUrl;
  envValues.NEXT_PUBLIC_CHAIN_ID = String(deployment.chainId);
  envValues.NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL =
    envValues.NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL || deployment.nativeSymbol;

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

