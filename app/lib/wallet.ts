import { Aptos } from "@aptos-labs/ts-sdk";
import { createMovementConfig } from "./aptos";

// Create Aptos client with Movement network config
export const aptos = new Aptos(createMovementConfig());

/**
 * Legacy wallet functions - kept for backward compatibility
 * New code should use wallet adapter hooks from @aptos-labs/wallet-adapter-react
 */

/**
 * @deprecated Use useWallet hook from WalletContext instead
 */
export async function connectWallet(): Promise<string | null> {
  console.warn("connectWallet is deprecated. Use useWallet hook instead.");
  return null;
}

/**
 * @deprecated Use useWallet hook from WalletContext instead
 */
export async function disconnectWallet(): Promise<void> {
  console.warn("disconnectWallet is deprecated. Use useWallet hook instead.");
}

/**
 * @deprecated Use useWallet hook from WalletContext instead
 */
export async function getAccount(): Promise<string | null> {
  console.warn("getAccount is deprecated. Use useWallet hook instead.");
  return null;
}

/**
 * @deprecated Use useWallet hook from WalletContext instead
 */
export async function isWalletConnected(): Promise<boolean> {
  console.warn("isWalletConnected is deprecated. Use useWallet hook instead.");
  return false;
}
