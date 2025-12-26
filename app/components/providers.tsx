"use client";

import { WalletProvider } from "@/app/components/wallet-provider";
import { WalletContextProvider } from "@/app/contexts/WalletContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <WalletContextProvider>{children}</WalletContextProvider>
    </WalletProvider>
  );
}
