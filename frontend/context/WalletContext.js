import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import {
  checkContractDeployed,
  isOwner as checkOwner,
  isMerchantAuthorizedOnChain,
} from '../lib/web3';

const WalletContext = createContext(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};

const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);
const EXPECTED_CHAIN_ID_HEX = `0x${EXPECTED_CHAIN_ID.toString(16)}`;
const ENV_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || '';
const RPC_HOST = process.env.NEXT_PUBLIC_RPC_HOST || '';
const RPC_PORT = Number(process.env.NEXT_PUBLIC_RPC_PORT || 8545);
const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK || 'Hardhat Localhost';
const NATIVE_SYMBOL = process.env.NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL || 'ETH';

export const WalletProvider = ({ children }) => {
  const [browserProvider, setBrowserProvider] = useState(null);
  const [resolvedRpcUrl, setResolvedRpcUrl] = useState(() => {
    if (ENV_RPC_URL) {
      return ENV_RPC_URL;
    }
    if (RPC_HOST) {
      return `http://${RPC_HOST}:${RPC_PORT}`;
    }
    return `http://127.0.0.1:${RPC_PORT}`;
  });
  const readOnlyProvider = useMemo(
    () => new ethers.JsonRpcProvider(resolvedRpcUrl),
    [resolvedRpcUrl]
  );

  const [networkChainId, setNetworkChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState(null);

  const [customerAddress, setCustomerAddress] = useState(null);
  const [customerSigner, setCustomerSigner] = useState(null);
  const [customerBalance, setCustomerBalance] = useState(null);

  const [merchantAddress, setMerchantAddress] = useState(null);
  const [merchantSigner, setMerchantSigner] = useState(null);
  const [merchantBalance, setMerchantBalance] = useState(null);

  const [isOwner, setIsOwner] = useState(false);
  const [isOwnerLoading, setIsOwnerLoading] = useState(false);
  const [isMerchant, setIsMerchant] = useState(false);
  const [isMerchantLoading, setIsMerchantLoading] = useState(false);

  const activeProvider = browserProvider || readOnlyProvider;
  const isCorrectNetwork = !networkChainId || networkChainId === EXPECTED_CHAIN_ID;
  const hasWarnedForNetwork = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const deriveRpcUrl = () => {
      if (ENV_RPC_URL && !ENV_RPC_URL.includes('127.0.0.1') && !ENV_RPC_URL.includes('localhost')) {
        return ENV_RPC_URL;
      }
      if (RPC_HOST && RPC_HOST !== '127.0.0.1' && RPC_HOST !== 'localhost') {
        return `http://${RPC_HOST}:${RPC_PORT}`;
      }
      const hostname = window.location.hostname;
      if (hostname && hostname !== '127.0.0.1' && hostname !== 'localhost') {
        return `http://${hostname}:${RPC_PORT}`;
      }
      return ENV_RPC_URL || `http://127.0.0.1:${RPC_PORT}`;
    };

    const nextUrl = deriveRpcUrl();
    setResolvedRpcUrl((previous) => {
      if (previous === nextUrl) {
        return previous;
      }
      console.log('[Wallet] Resolved RPC URL:', nextUrl);
      return nextUrl;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!networkChainId || networkChainId === EXPECTED_CHAIN_ID) {
      hasWarnedForNetwork.current = false;
      return;
    }
    if (!hasWarnedForNetwork.current) {
      window.alert(
        `MetaMask is connected to chain ${networkChainId}. Switch to Hardhat Localhost (${EXPECTED_CHAIN_ID}).`
      );
      hasWarnedForNetwork.current = true;
    }
  }, [networkChainId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    const providerInstance = new ethers.BrowserProvider(window.ethereum, 'any');
    setBrowserProvider(providerInstance);

    providerInstance
      .getNetwork()
      .then((network) => setNetworkChainId(Number(network.chainId)))
      .catch((error) => {
        console.error('Unable to resolve current network:', error);
      });

    const handleChainChanged = (hexChainId) => {
      const chainId = Number.parseInt(hexChainId, 16);
      setNetworkChainId(chainId);
      console.log('[Wallet] chainChanged event:', chainId);
      if (chainId !== EXPECTED_CHAIN_ID) {
        window.alert(
          `MetaMask is connected to chain ${chainId}. Switch to Hardhat Localhost (${EXPECTED_CHAIN_ID}).`
        );
      }
    };

    const handleAccountsChanged = (accounts) => {
      const normalised = (accounts || []).map((address) => ethers.getAddress(address));
      console.log('[Wallet] accountsChanged event:', normalised);
      setCustomerAddress((prev) => {
        if (!prev) {
          return prev;
        }
        if (normalised.includes(prev)) {
          return prev;
        }
        setCustomerSigner(null);
        setCustomerBalance(null);
        return null;
      });
      setMerchantAddress((prev) => {
        if (!prev) {
          return prev;
        }
        if (normalised.includes(prev)) {
          return prev;
        }
        setMerchantSigner(null);
        setMerchantBalance(null);
        setIsOwner(false);
        setIsMerchant(false);
        return null;
      });
    };

    const handleDisconnect = () => {
      console.log('[Wallet] disconnect event received from provider');
      setBrowserProvider(null);
      setNetworkChainId(null);
    };

    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    return () => {
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    };
  }, []);

  const switchToExpectedNetwork = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Wallet provider not available to switch network.');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: EXPECTED_CHAIN_ID_HEX }],
      });
    } catch (error) {
      if (error?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: EXPECTED_CHAIN_ID_HEX,
              chainName: NETWORK_NAME,
              nativeCurrency: {
                name: NATIVE_SYMBOL,
                symbol: NATIVE_SYMBOL,
                decimals: 18,
              },
              rpcUrls: [resolvedRpcUrl],
            },
          ],
        });
      } else {
        throw error;
      }
    }
  }, [NETWORK_NAME, NATIVE_SYMBOL, EXPECTED_CHAIN_ID_HEX, resolvedRpcUrl]);

  const connectRole = useCallback(
    async (role) => {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask (window.ethereum) is not available in this environment.');
      }

      setIsConnecting(true);
      setLastError(null);

      try {
        await window.ethereum
          .request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          })
          .catch(() => null);

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts were returned by the wallet.');
        }

        const selectedAddress = ethers.getAddress(accounts[0]);
        const providerInstance = new ethers.BrowserProvider(window.ethereum, 'any');
        setBrowserProvider(providerInstance);

        let network = await providerInstance.getNetwork();
        let chainId = Number(network.chainId);
        setNetworkChainId(chainId);

        if (chainId !== EXPECTED_CHAIN_ID) {
          console.warn(
            `[Wallet] ${role} connected to chain ${chainId}. Requesting switch to ${EXPECTED_CHAIN_ID}.`
          );
          window.alert(
            `Switch MetaMask to the Hardhat Localhost network (chainId ${EXPECTED_CHAIN_ID}). Current chainId: ${chainId}.`
          );
          await switchToExpectedNetwork();
          network = await providerInstance.getNetwork();
          chainId = Number(network.chainId);
          setNetworkChainId(chainId);
          if (chainId !== EXPECTED_CHAIN_ID) {
            throw new Error(
              `MetaMask must be connected to the Hardhat Localhost network (chainId ${EXPECTED_CHAIN_ID}).`
            );
          }
        }

        const signer = await providerInstance.getSigner(selectedAddress);
        const balanceWei = await providerInstance.getBalance(selectedAddress);
        const formattedBalance = ethers.formatEther(balanceWei);

        console.log(`[Wallet] ${role} active account: ${selectedAddress}`);
        console.log('[Wallet] Resolved RPC URL:', resolvedRpcUrl);
        console.log(`[Wallet] Network chain ID: ${chainId}`);
        console.log(`[Wallet] ${role} balance (${NATIVE_SYMBOL}): ${formattedBalance}`);

        if (role === 'customer') {
          setCustomerAddress(selectedAddress);
          setCustomerSigner(signer);
          setCustomerBalance(formattedBalance);
        } else {
          setMerchantAddress(selectedAddress);
          setMerchantSigner(signer);
          setMerchantBalance(formattedBalance);
        }

        return {
          address: selectedAddress,
          signer,
          balance: formattedBalance,
          chainId,
        };
      } catch (error) {
        console.error(`Failed to connect ${role} wallet:`, error);
        setLastError(error);
        throw error;
      } finally {
        setIsConnecting(false);
      }
    },
    [EXPECTED_CHAIN_ID, NATIVE_SYMBOL, resolvedRpcUrl, switchToExpectedNetwork]
  );

  const connectCustomerWallet = useCallback(() => connectRole('customer'), [connectRole]);
  const connectMerchantWallet = useCallback(() => connectRole('merchant'), [connectRole]);

  const disconnectCustomerWallet = useCallback(() => {
    setCustomerAddress(null);
    setCustomerSigner(null);
    setCustomerBalance(null);
  }, []);

  const disconnectMerchantWallet = useCallback(() => {
    setMerchantAddress(null);
    setMerchantSigner(null);
    setMerchantBalance(null);
    setIsOwner(false);
    setIsMerchant(false);
  }, []);

  const ensureCorrectNetwork = useCallback(async () => {
    if (networkChainId === EXPECTED_CHAIN_ID) {
      return;
    }
    await switchToExpectedNetwork();
  }, [networkChainId, switchToExpectedNetwork]);

  useEffect(() => {
    const determineOwner = async () => {
      if (!merchantAddress || !activeProvider) {
        setIsOwner(false);
        return;
      }

      setIsOwnerLoading(true);
      try {
        const deployed = await checkContractDeployed(activeProvider);
        if (!deployed) {
          console.warn('Contract not found at configured address. Owner check skipped.');
          setIsOwner(false);
          return;
        }
        const ownerMatch = await checkOwner(merchantAddress, activeProvider);
        setIsOwner(ownerMatch);
      } catch (error) {
        console.error('Unable to determine owner status:', error);
        setIsOwner(false);
      } finally {
        setIsOwnerLoading(false);
      }
    };

    determineOwner();
  }, [merchantAddress, activeProvider]);

  useEffect(() => {
    const determineMerchant = async () => {
      if (!merchantAddress || !activeProvider) {
        setIsMerchant(false);
        return;
      }

      setIsMerchantLoading(true);
      try {
        const deployed = await checkContractDeployed(activeProvider);
        if (!deployed) {
          setIsMerchant(false);
          return;
        }
        const merchantMatch = await isMerchantAuthorizedOnChain(merchantAddress, activeProvider);
        setIsMerchant(merchantMatch);
      } catch (error) {
        console.error('Unable to determine merchant status:', error);
        setIsMerchant(false);
      } finally {
        setIsMerchantLoading(false);
      }
    };

    determineMerchant();
  }, [merchantAddress, activeProvider]);

  const value = useMemo(
    () => ({
      provider: activeProvider,
      browserProvider,
      readOnlyProvider,
      expectedChainId: EXPECTED_CHAIN_ID,
      networkChainId,
      isCorrectNetwork,
      isConnecting,
      lastError,
      connectCustomerWallet,
      connectMerchantWallet,
      disconnectCustomerWallet,
      disconnectMerchantWallet,
      switchToExpectedNetwork,
      ensureCorrectNetwork,
      customerAddress,
      customerSigner,
      customerBalance,
      merchantAddress,
      merchantSigner,
      merchantBalance,
      isOwner,
      isOwnerLoading,
      isMerchant,
      isMerchantLoading,
    }),
    [
      activeProvider,
      browserProvider,
      readOnlyProvider,
      networkChainId,
      isCorrectNetwork,
      isConnecting,
      lastError,
      connectCustomerWallet,
      connectMerchantWallet,
      disconnectCustomerWallet,
      disconnectMerchantWallet,
      switchToExpectedNetwork,
      ensureCorrectNetwork,
      customerAddress,
      customerSigner,
      customerBalance,
      merchantAddress,
      merchantSigner,
      merchantBalance,
      isOwner,
      isOwnerLoading,
      isMerchant,
      isMerchantLoading,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
