"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { useWallet } from "../../contexts/WalletContext";
import { WalletSelectionModal } from "../wallet-selection-modal";

export const Header: React.FC = () => {
  const pathname = usePathname();
  const { address, isConnected, isLoading, disconnect } = useWallet();

  const baseNavLinks = [
    { name: "Leaderboard", path: "/leaderboard" },
    { name: "My Pacts", path: "/pacts" },
    { name: "Resolve", path: "/resolve" },
    { name: "Create Pact", path: "/create" },
  ];

  // If user is connected, add profile link
  const navLinks =
    isConnected && address
      ? [
          baseNavLinks[0],
          { name: "Profile", path: `/profile/${address}` },
          ...baseNavLinks.slice(1),
        ]
      : baseNavLinks;

  const formatAddress = (addr: string | null | undefined) => {
    if (!addr || typeof addr !== "string") {
      return "";
    }
    if (addr.length < 10) {
      return addr;
    }
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0E0F12]/80 backdrop-blur-md border-b border-[#23262F] px-4 py-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/logo.png"
            alt="Pact Logo"
            width={32}
            height={32}
            className="object-contain w-12 h-12 shrink-0"
            priority
            unoptimized
          />
          {/* <span className="text-xl font-bold tracking-tighter uppercase group-hover:text-[#F26B3A] transition-colors">Pact</span> */}
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`text-sm font-medium uppercase tracking-wider transition-colors hover:text-[#F26B3A] ${
                pathname === link.path ? "text-[#F26B3A]" : "text-[#8E9094]"
              }`}
            >
              {link.name}
            </Link>
          ))}
          {isConnected && address ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#8E9094] font-mono">
                {formatAddress(address)}
              </span>
              <Button size="sm" variant="outline" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <WalletSelectionModal>
              <Button size="sm" disabled={isLoading}>
                {isLoading ? "Connecting..." : "Connect Wallet"}
              </Button>
            </WalletSelectionModal>
          )}
        </nav>

        <div className="flex md:hidden">
          {isConnected && address ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8E9094] font-mono">
                {formatAddress(address)}
              </span>
              <Button size="sm" variant="outline" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <WalletSelectionModal>
              <Button size="sm" disabled={isLoading}>
                {isLoading ? "..." : "Connect"}
              </Button>
            </WalletSelectionModal>
          )}
        </div>
      </div>
    </header>
  );
};
