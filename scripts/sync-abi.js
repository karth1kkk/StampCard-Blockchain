const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const hardhatDir = path.join(rootDir, 'hardhat', 'artifacts', 'contracts');
const frontendConstantsDir = path.join(rootDir, 'frontend', 'constants');
const frontendLibDir = path.join(rootDir, 'frontend', 'lib');

const contracts = [
  { name: 'CoffeeLoyalty', jsonPath: 'CoffeeLoyalty.sol/CoffeeLoyalty.json', output: 'coffeeloyalty.json', exportName: 'COFFEE_LOYALTY_ABI' },
  { name: 'BrewToken', jsonPath: 'BrewToken.sol/BrewToken.json', output: 'brewtoken.json', exportName: 'BREW_TOKEN_ABI' },
];

try {
  if (!fs.existsSync(frontendConstantsDir)) {
    fs.mkdirSync(frontendConstantsDir, { recursive: true });
  }

  const exports = [];

  contracts.forEach(({ name, jsonPath, output, exportName }) => {
    const artifactPath = path.join(hardhatDir, jsonPath);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Artifact not found for ${name} at ${artifactPath}. Compile contracts first.`);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const abi = artifact.abi;
    const frontendAbiPath = path.join(frontendConstantsDir, output);
    fs.writeFileSync(frontendAbiPath, JSON.stringify(abi, null, 2));
    exports.push({ exportName, output });
  });

  const importLines = exports
    .map(({ exportName, output }) => {
      const localName = `${exportName.toLowerCase()}Data`;
      return { localName, line: `import ${localName} from '../constants/${output}';`, exportName };
    });

  const fileContent = `// Contract ABIs - Auto-generated from hardhat artifacts
// Run: npm run sync:abi to update this file

${importLines.map(({ line }) => line).join('\n')}

${importLines
  .map(({ exportName, localName }) => `export const ${exportName} = ${localName};`)
  .join('\n')}
`;

  fs.writeFileSync(path.join(frontendLibDir, 'contractABI.js'), fileContent, 'utf8');
  console.log('✅ ABIs synced successfully from hardhat to frontend');
} catch (error) {
  console.error('❌ Error syncing ABI:', error.message);
  console.error('Make sure you have compiled the contracts first: cd hardhat && npm run compile');
  process.exit(1);
}
