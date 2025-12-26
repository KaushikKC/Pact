import { AptosConfig, Network } from "@aptos-labs/ts-sdk";
// import { Network as WalletAdapterNetwork } from "@aptos-labs/wallet-adapter-react";

/**
 * Movement Network Configuration
 */
export const MOVEMENT_CONFIGS = {
  mainnet: {
    chainId: 126,
    name: "Movement Mainnet",
    fullnode: "https://full.mainnet.movementinfra.xyz/v1",
    explorer: "mainnet",
  },
  testnet: {
    chainId: 250,
    name: "Movement Testnet",
    fullnode: "https://testnet.movementnetwork.xyz/v1",
    explorer: "testnet",
  },
} as const;

/**
 * Current network to use
 */
export const CURRENT_NETWORK: keyof typeof MOVEMENT_CONFIGS = "testnet";

/**
 * Create AptosConfig for Movement network (for SDK usage)
 */
export function createMovementConfig() {
  const config = MOVEMENT_CONFIGS[CURRENT_NETWORK];

  return new AptosConfig({
    network: Network.CUSTOM,
    fullnode: config.fullnode,
    // Add other config as needed
  });
}

/**
 * Create dapp config for wallet adapter
 * This includes network config and wallet filtering
 *
 * Note: optInWallets prevents unsupported wallets (like Google Wallet) from initializing
 */
// export function createDappConfig() {
//   const config = MOVEMENT_CONFIGS[CURRENT_NETWORK];

//   return {
//     // Use Network.CUSTOM from wallet adapter for custom networks
//     network: WalletAdapterNetwork.CUSTOM,
//     fullnode: config.fullnode,
//     // Only include wallets that support custom networks
//     // This prevents errors from wallets like Google Wallet that don't support custom networks
//     optInWallets: [
//       "Petra",
//       "Nightly",
//       "Martian",
//       "Pontem",
//       "Fewcha",
//       "Rise",
//       "Spika",
//       "Bitkeep",
//       "Trust Wallet",
//       "OKX Wallet",
//     ],
//   };
// }
