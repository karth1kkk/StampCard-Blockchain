const fs = require('fs');
const path = require('path');

// Paths
const hardhatArtifactPath = path.join(__dirname, '../hardhat/artifacts/contracts/StampCard.sol/StampCard.json');
const frontendABIPath = path.join(__dirname, '../frontend/lib/contractABI.js');

try {
  // Read the artifact file
  const artifact = JSON.parse(fs.readFileSync(hardhatArtifactPath, 'utf8'));
  const abi = artifact.abi;

  // Generate the new ABI file content
  const fileContent = `// Contract ABI - Auto-generated from hardhat artifacts
// Run: npm run sync:abi to update this file

export const STAMPCARD_ABI = ${JSON.stringify(abi, null, 2)};
`;

  // Write to frontend
  fs.writeFileSync(frontendABIPath, fileContent, 'utf8');
  console.log('✅ ABI synced successfully from hardhat to frontend');
} catch (error) {
  console.error('❌ Error syncing ABI:', error.message);
  console.error('Make sure you have compiled the contracts first: cd hardhat && npm run compile');
  process.exit(1);
}

