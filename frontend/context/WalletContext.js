import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { checkContractDeployed, getContractOwner } from '../lib/web3';

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
const LOOPBACK_RPC_URL = `http://127.0.0.1:${RPC_PORT}`;
const isLoopbackOrHttps = (url) => {
  if (typeof url !== 'string') {
    return false;
  }
  return url.includes('127.0.0.1') || url.includes('localhost') || url.startsWith('https://');
};
const LEGACY_CHAIN_ID = 1337;
const ALLOWED_CHAIN_IDS = new Set([EXPECTED_CHAIN_ID, LEGACY_CHAIN_ID]);
const AUTO_CONNECT_KEY = 'brewtoken:auto-connect';

export const WalletProvider = ({ children }) => {
  const [browserProvider, setBrowserProvider] = useState(null);
  const [resolvedRpcUrl, setResolvedRpcUrl] = useState(() => {
    if (isLoopbackOrHttps(ENV_RPC_URL)) {
      return ENV_RPC_URL;
    }
    return LOOPBACK_RPC_URL;
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

  const [isOwner, setIsOwner] = useState(false);
  const [isOwnerLoading, setIsOwnerLoading] = useState(false);

  const activeProvider = browserProvider || readOnlyProvider;
  const isCorrectNetwork =
    !networkChainId || ALLOWED_CHAIN_IDS.has(Number(networkChainId));
  const hasWarnedForNetwork = useRef(false);

  const persistAutoConnectPreference = useCallback((enabled) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(AUTO_CONNECT_KEY, enabled ? '1' : '0');
    } catch (error) {
      console.warn('Unable to persist auto-connect preference:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const deriveRpcUrl = () => {
      if (isLoopbackOrHttps(ENV_RPC_URL)) {
        return ENV_RPC_URL;
      }
      if (RPC_HOST && (RPC_HOST === '127.0.0.1' || RPC_HOST === 'localhost')) {
        return `http://${RPC_HOST}:${RPC_PORT}`;
      }
      return LOOPBACK_RPC_URL;
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
    if (!networkChainId || ALLOWED_CHAIN_IDS.has(Number(networkChainId))) {
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
      if (!ALLOWED_CHAIN_IDS.has(chainId)) {
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
      setIsOwner(false);
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

  const hydrateConnection = useCallback(
    async ({ providerInstance, selectedAddress, allowSwitch = false, role }) => {
      setBrowserProvider(providerInstance);

      let network = await providerInstance.getNetwork();
      let chainId = Number(network.chainId);
      setNetworkChainId(chainId);

      if (!ALLOWED_CHAIN_IDS.has(chainId)) {
        if (allowSwitch) {
          console.warn(
            `[Wallet] ${role ?? 'session'} connected to chain ${chainId}. Requesting switch to ${EXPECTED_CHAIN_ID}.`
          );
          window.alert(
            `Switch MetaMask to the Hardhat Localhost network (chainId ${EXPECTED_CHAIN_ID}). Current chainId: ${chainId}.`
          );
          await switchToExpectedNetwork();
          network = await providerInstance.getNetwork();
          chainId = Number(network.chainId);
          setNetworkChainId(chainId);
          if (!ALLOWED_CHAIN_IDS.has(chainId)) {
            throw new Error(
              `MetaMask must be connected to an allowed local network (chainId ${EXPECTED_CHAIN_ID}).`
            );
          }
        } else {
          throw new Error(
            `MetaMask must be connected to an allowed local network (chainId ${EXPECTED_CHAIN_ID}).`
          );
        }
      }

      const signer = await providerInstance.getSigner(selectedAddress);
      const balanceWei = await providerInstance.getBalance(selectedAddress);
      const formattedBalance = ethers.formatEther(balanceWei);

      setCustomerAddress(selectedAddress);
      setCustomerSigner(signer);
      setCustomerBalance(formattedBalance);

      persistAutoConnectPreference(true);

      console.log(`[Wallet] ${role ?? 'session'} active account: ${selectedAddress}`);
      console.log('[Wallet] Resolved RPC URL:', resolvedRpcUrl);
      console.log(`[Wallet] Network chain ID: ${chainId}`);
      console.log(`[Wallet] ${role ?? 'session'} balance (${NATIVE_SYMBOL}): ${formattedBalance}`);

      return {
        address: selectedAddress,
        signer,
        balance: formattedBalance,
        chainId,
      };
    },
    [EXPECTED_CHAIN_ID, NATIVE_SYMBOL, persistAutoConnectPreference, resolvedRpcUrl, switchToExpectedNetwork]
  );

  const connectRole = useCallback(
    async (role) => {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask (window.ethereum) is not available in this environment.');
      }

      setIsConnecting(true);
      setLastError(null);

      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts were returned by the wallet.');
        }

        const selectedAddress = ethers.getAddress(accounts[0]);
        const providerInstance = new ethers.BrowserProvider(window.ethereum, 'any');
      return await hydrateConnection({
        providerInstance,
        selectedAddress,
        allowSwitch: true,
        role,
      });
      } catch (error) {
        // Don't log or throw errors for user rejections (code 4001)
        const isUserRejection = error?.code === 4001 || error?.message?.includes('User rejected');
        if (!isUserRejection) {
          console.error(`Failed to connect ${role} wallet:`, error);
          setLastError(error);
        }
        throw error;
      } finally {
        setIsConnecting(false);
      }
    },
    [hydrateConnection]
  );

  const connectCustomerWallet = useCallback(() => connectRole('customer'), [connectRole]);

  const disconnectCustomerWallet = useCallback(() => {
    setCustomerAddress(null);
    setCustomerSigner(null);
    setCustomerBalance(null);
    setIsOwner(false);
    persistAutoConnectPreference(false);
  }, []);

  const ensureCorrectNetwork = useCallback(async () => {
    if (networkChainId && ALLOWED_CHAIN_IDS.has(Number(networkChainId))) {
      return;
    }
    await switchToExpectedNetwork();
  }, [networkChainId, switchToExpectedNetwork]);

  useEffect(() => {
    const determineOwner = async () => {
      if (!activeProvider) {
        setMerchantAddress(null);
        setIsOwner(false);
        return;
      }

      setIsOwnerLoading(true);
      try {
        const deployed = await checkContractDeployed(activeProvider);
        if (!deployed) {
          console.warn('Contract not found at configured address. Owner check skipped.');
          setMerchantAddress(null);
          setIsOwner(false);
          return;
        }
        const ownerAddress = await getContractOwner(activeProvider);
        setMerchantAddress(ownerAddress);
        if (!ownerAddress || !customerAddress) {
          setIsOwner(false);
          return;
        }
        const ownerMatch = ownerAddress.toLowerCase() === customerAddress.toLowerCase();
        setIsOwner(ownerMatch);
      } catch (error) {
        console.error('Unable to determine owner status:', error);
        setMerchantAddress(null);
        setIsOwner(false);
      } finally {
        setIsOwnerLoading(false);
      }
    };

    determineOwner();
  }, [activeProvider, customerAddress]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }
    if (customerAddress) {
      return;
    }
    const shouldAutoConnect = window.localStorage.getItem(AUTO_CONNECT_KEY) === '1';
    if (!shouldAutoConnect) {
      return;
    }

    let cancelled = false;
    const attemptAutoConnect = async () => {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          return;
        }
        const selectedAddress = ethers.getAddress(accounts[0]);
        const providerInstance = new ethers.BrowserProvider(window.ethereum, 'any');
        if (cancelled) {
          return;
        }
        await hydrateConnection({
          providerInstance,
          selectedAddress,
          allowSwitch: false,
          role: 'auto',
        });
        console.log('[Wallet] Auto-connected to previously authorised account:', selectedAddress);
      } catch (error) {
        console.warn('Auto-connect skipped:', error?.message || error);
      }
    };

    attemptAutoConnect();

    return () => {
      cancelled = true;
    };
  }, [customerAddress, hydrateConnection]);

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
      disconnectCustomerWallet,
      switchToExpectedNetwork,
      ensureCorrectNetwork,
      customerAddress,
      customerSigner,
      customerBalance,
      merchantAddress,
      isOwner,
      isOwnerLoading,
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
      disconnectCustomerWallet,
      switchToExpectedNetwork,
      ensureCorrectNetwork,
      customerAddress,
      customerSigner,
      customerBalance,
      merchantAddress,
      isOwner,
      isOwnerLoading,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
