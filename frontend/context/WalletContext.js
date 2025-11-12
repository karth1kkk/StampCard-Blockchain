import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchNetwork } from 'wagmi';
import {
  checkContractDeployed,
  isOwner as checkOwner,
  isMerchantAuthorizedOnChain,
} from '../lib/web3';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};

const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1337);

export const WalletProvider = ({ children }) => {
  const { address, status } = useAccount();
  const chainId = useChainId();
  const { connectors, connectAsync, isPending: connectPending } = useConnect();
  const { disconnectAsync, isPending: disconnectPending } = useDisconnect();
  const { switchNetworkAsync, isPending: networkPending } = useSwitchNetwork();

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isOwnerLoading, setIsOwnerLoading] = useState(false);
  const [isMerchant, setIsMerchant] = useState(false);
  const [isMerchantLoading, setIsMerchantLoading] = useState(false);

  const account = address || null;
  const isConnecting = status === 'connecting' || connectPending || networkPending;
  const isDisconnecting = disconnectPending;
  const isCorrectNetwork = !account || chainId === EXPECTED_CHAIN_ID;

  useEffect(() => {
    if (typeof window === 'undefined' || !account) {
      setProvider(null);
      setSigner(null);
      return;
    }

    let isMounted = true;

    const initialise = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('Wallet provider not found. Install MetaMask or use WalletConnect.');
        }
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const walletSigner = await browserProvider.getSigner();
        if (!isMounted) return;
        setProvider(browserProvider);
        setSigner(walletSigner);
      } catch (error) {
        console.error('Failed to initialise wallet provider:', error);
        if (isMounted) {
          setProvider(null);
          setSigner(null);
        }
      }
    };

    initialise();

    return () => {
      isMounted = false;
    };
  }, [account]);

  useEffect(() => {
    const determineOwner = async () => {
      if (!account || !provider) {
        setIsOwner(false);
        return;
      }

      setIsOwnerLoading(true);
      try {
        const deployed = await checkContractDeployed(provider);
        if (!deployed) {
          console.warn('Contract not found at configured address. Owner check skipped.');
          setIsOwner(false);
          return;
        }
        const ownerMatch = await checkOwner(account, provider);
        setIsOwner(ownerMatch);
      } catch (error) {
        console.error('Unable to determine owner status:', error);
        setIsOwner(false);
      } finally {
        setIsOwnerLoading(false);
      }
    };

    determineOwner();
  }, [account, provider]);

  useEffect(() => {
    const determineMerchant = async () => {
      if (!account || !provider) {
        setIsMerchant(false);
        return;
      }

      setIsMerchantLoading(true);
      try {
        const deployed = await checkContractDeployed(provider);
        if (!deployed) {
          setIsMerchant(false);
          return;
        }
        const merchantMatch = await isMerchantAuthorizedOnChain(account, provider);
        setIsMerchant(merchantMatch);
      } catch (error) {
        console.error('Unable to determine merchant status:', error);
        setIsMerchant(false);
      } finally {
        setIsMerchantLoading(false);
      }
    };

    determineMerchant();
  }, [account, provider]);

  const connect = useCallback(
    async (connectorId) => {
      const targetConnector =
        connectors.find((connector) => connector.id === connectorId) ||
        connectors.find((connector) => connector.ready) ||
        connectors[0];

      if (!targetConnector) {
        throw new Error('No available wallet connectors.');
      }

      await connectAsync({ connector: targetConnector, chainId: EXPECTED_CHAIN_ID });
    },
    [connectAsync, connectors]
  );

  const disconnect = useCallback(async () => {
    await disconnectAsync();
    setProvider(null);
    setSigner(null);
    setIsOwner(false);
    setIsMerchant(false);
  }, [disconnectAsync]);

  const switchToExpectedNetwork = useCallback(async () => {
    if (!switchNetworkAsync) {
      throw new Error('Network switching is not supported by the connected wallet.');
    }
    await switchNetworkAsync({ chainId: EXPECTED_CHAIN_ID });
  }, [switchNetworkAsync]);

  const value = useMemo(
    () => ({
      account,
      provider,
      signer,
      isOwner,
      isOwnerLoading,
      isMerchant,
      isMerchantLoading,
      isConnecting,
      isDisconnecting,
      isCorrectNetwork,
      chainId,
      connect,
      disconnect,
      connectors,
      switchToExpectedNetwork,
    }),
    [
      account,
      provider,
      signer,
      isOwner,
      isOwnerLoading,
      isMerchant,
      isMerchantLoading,
      isConnecting,
      isDisconnecting,
      isCorrectNetwork,
      chainId,
      connect,
      disconnect,
      connectors,
      switchToExpectedNetwork,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
