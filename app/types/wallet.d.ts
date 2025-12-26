/**
 * Petra Wallet Type Definitions
 * Extends Window interface with Petra wallet methods
 */
interface Window {
  aptos?: {
    connect: () => Promise<{ address: string }>;
    disconnect: () => Promise<void>;
    account: () => Promise<{ address: string }>;
    signAndSubmitTransaction: (txn: any) => Promise<{ hash: string }>;
    signTransaction: (txn: any) => Promise<any>;
    isConnected: () => Promise<boolean>;
  };
}
