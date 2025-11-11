// wagmi configuration for StampCard dapp
'use client';

import { createConfig } from 'wagmi';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { createPublicClient, defineChain, http } from 'viem';

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1337);
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const networkName = process.env.NEXT_PUBLIC_NETWORK || 'StampCard Local';
const nativeSymbol = process.env.NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL || 'ETH';

export const stampCardChain = defineChain({
  id: chainId,
  name: networkName,
  network: networkName.toLowerCase().replace(/\s+/g, '-'),
  nativeCurrency: {
    decimals: 18,
    name: nativeSymbol,
    symbol: nativeSymbol,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
});

const connectors = [
  new MetaMaskConnector({
    chains: [stampCardChain],
    options: {
      dappMetadata: { name: 'StampCard Loyalty' },
      shimDisconnect: true,
    },
  }),
];

const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

if (walletConnectProjectId) {
  connectors.push(
    new WalletConnectConnector({
      chains: [stampCardChain],
      options: {
        projectId: walletConnectProjectId,
        showQrModal: true,
        metadata: {
          name: 'StampCard Loyalty',
          description: 'Customer QR scanning for on-chain stamps',
          url: 'https://stampcard.local',
          icons: ['https://stampcard.local/icon.png'],
        },
      },
    })
  );
}

const publicClient = createPublicClient({
  chain: stampCardChain,
  transport: http(rpcUrl),
});

export const wagmiConfig = createConfig({
  chains: [stampCardChain],
  connectors,
  publicClient,
  ssr: true,
});

