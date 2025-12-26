"use client";

import { createContext, useContext, ReactNode } from "react";
import { useWallet as useAptosWallet } from "@aptos-labs/wallet-adapter-react";

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  walletName: string | null;
  wallets: any[];
  signAndSubmitTransaction?: (transaction: any) => Promise<{ hash: string }>;
}

// Default context value for SSR
const defaultContextValue: WalletContextType = {
  address: null,
  isConnected: false,
  isLoading: false,
  connect: async () => {},
  disconnect: async () => {},
  walletName: null,
  wallets: [],
  signAndSubmitTransaction: undefined,
};

const WalletContext = createContext<WalletContextType>(defaultContextValue);

/**
 * Custom wallet hook that wraps Aptos wallet adapter
 * Provides simplified interface for the app
 * Safe to use during SSR - returns default values
 */
export function useWallet() {
  const context = useContext(WalletContext);

  // Always return context (has default values during SSR)
  return context;
}

/**
 * Wallet Context Provider
 * This is a wrapper that provides a simplified interface
 * The actual provider is AptosWalletAdapterProvider in wallet-provider.tsx
 *
 * This component must be rendered inside AptosWalletAdapterProvider
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  // Use wallet adapter hook - this will work when inside AptosWalletAdapterProvider
  // During SSR, this will throw, so we need to handle it at a higher level
  const {
    account,
    connected,
    isLoading,
    connect: aptosConnect,
    disconnect: aptosDisconnect,
    wallet: currentWallet,
    wallets,
    signAndSubmitTransaction,
  } = useAptosWallet();

  const connect = async (walletName?: string) => {
    if (walletName) {
      await aptosConnect(walletName);
    } else {
      // If no wallet specified, connect to first available
      if (wallets && wallets.length > 0) {
        await aptosConnect(wallets[0].name);
      }
    }
  };

  const disconnect = async () => {
    await aptosDisconnect();
  };

  const walletData: WalletContextType = {
    // Ensure address is a string
    address: account?.address ? String(account.address) : null,
    isConnected: connected,
    isLoading,
    connect,
    disconnect,
    walletName: currentWallet?.name || null,
    wallets: (wallets ? [...wallets] : []) as any[],
    signAndSubmitTransaction,
  };

  return (
    <WalletContext.Provider value={walletData}>
      {children}
    </WalletContext.Provider>
  );
}
