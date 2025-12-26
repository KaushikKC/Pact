"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";

interface WalletSelectionModalProps {
  children: React.ReactNode;
}

export function WalletSelectionModal({ children }: WalletSelectionModalProps) {
  const [open, setOpen] = useState(false);
  const { wallets, connect } = useWallet();

  // Filter out unwanted wallets and remove duplicates
  const filteredWallets = wallets
    ?.filter((wallet) => {
      const name = wallet.name.toLowerCase();
      // Filter out wallets you don't want
      return !name.includes("google") && !name.includes("apple");
    })
    .filter((wallet, index, self) => {
      // Remove duplicates based on wallet name
      return index === self.findIndex((w) => w.name === wallet.name);
    })
    .sort((a, b) => {
      // Nightly always first
      if (a.name.toLowerCase().includes("nightly")) return -1;
      if (b.name.toLowerCase().includes("nightly")) return 1;
      return 0;
    });

  const handleWalletSelect = async (walletName: string) => {
    try {
      // Skip wallet-standard connection for now - go directly to adapter
      // The wallet adapter handles the connection properly
      await connect(walletName as any);
      setOpen(false);
    } catch (error: any) {
      // Only treat actual user rejections as cancellations
      const errorMessage = error?.message || error?.toString() || "";
      const isUserRejection =
        errorMessage.includes("User has rejected") ||
        errorMessage.includes("rejected the request") ||
        errorMessage.includes("User rejected");

      if (isUserRejection) {
        // User cancelled - not an error, just close modal
        setOpen(false);
        return;
      }

      // Log other errors but don't close modal - let user try again
      console.error("Wallet connection error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet to connect to Movement Network
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Native Wallet Options */}
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-1">Connect Wallet</h3>
              <p className="text-xs text-muted-foreground">
                Use your existing Aptos wallet
              </p>
            </div>
            <div className="space-y-2">
              {filteredWallets?.length === 0 ? (
                <div className="text-center py-6 px-4 border border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    No wallets detected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Please install a supported Aptos wallet like Nightly or
                    Petra
                  </p>
                </div>
              ) : (
                filteredWallets?.map((wallet) => (
                  <Button
                    key={wallet.name}
                    variant="outline"
                    className="w-full justify-start h-12 hover:bg-accent hover:text-[#15171c]"
                    onClick={() => handleWalletSelect(wallet.name)}
                  >
                    <div className="flex items-center space-x-3">
                      {wallet.icon && (
                        <img
                          src={wallet.icon}
                          alt={wallet.name}
                          className="w-6 h-6 rounded"
                        />
                      )}
                      <span className="font-medium">{wallet.name}</span>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
