"use client";

import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useWallet } from "../contexts/WalletContext";
import {
  fetchAllPacts,
  fetchPact,
  submitResolvePactTransaction,
  getCurrentBalance,
} from "../lib/pactTransactions";
import { PactStatusBadge } from "../components/pact/pact-status-badge";

type PactStatus = "ACTIVE" | "PASSED" | "FAILED";

interface Pact {
  id: string;
  index: number;
  tokenAddress: string;
  startBalance: number;
  stakeAmount: number;
  deadline: number;
  status: PactStatus;
  creator: string;
}

function ResolvePactPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected, signAndSubmitTransaction } = useWallet();
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPact, setSelectedPact] = useState<Pact | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<"SUCCESS" | "FAILURE" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load all active pacts from ALL users that can be resolved
  useEffect(() => {
    const loadActivePacts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch ALL pacts from ALL users
        const allPacts = await fetchAllPacts();
        const now = Math.floor(Date.now() / 1000);

        // Filter for active pacts that have passed their deadline (can be resolved)
        const activePactsData: Pact[] = allPacts
          .filter((pact) => {
            const status =
              pact.status === 0
                ? "ACTIVE"
                : pact.status === 1
                ? "PASSED"
                : "FAILED";
            return status === "ACTIVE" && pact.deadline <= now;
          })
          .map((pact) => ({
            id: `${pact.creator}-${pact.index}`,
            index: pact.index,
            tokenAddress: pact.tokenAddress,
            startBalance: pact.startBalance,
            stakeAmount: pact.stakeAmount,
            deadline: pact.deadline,
            status: "ACTIVE" as PactStatus,
            creator: pact.creator,
          }));

        setPacts(activePactsData);
        console.log(
          `[Resolve Page] Found ${activePactsData.length} resolvable pacts`
        );
      } catch (err: any) {
        console.error("Error loading pacts:", err);
        setError(err?.message || "Failed to load pacts");
      } finally {
        setIsLoading(false);
      }
    };

    loadActivePacts();
  }, []);

  // Load specific pact from URL param
  useEffect(() => {
    const pactId = searchParams?.get("pact");
    if (pactId && pacts.length > 0) {
      const pact = pacts.find((p) => p.id === pactId);
      if (pact) {
        setSelectedPact(pact);
        loadBalanceForPact(pact);
      }
    }
  }, [searchParams, pacts]);

  // Load current balance for selected pact
  const loadBalanceForPact = async (pact: Pact) => {
    try {
      // For MVP, we're tracking MOVE balance
      // In production, you'd fetch the balance of the specific token
      const balance = await getCurrentBalance(pact.creator);
      setCurrentBalance(balance);
    } catch (err: any) {
      console.error("Error loading balance:", err);
      setError("Failed to load current balance");
    }
  };

  const handlePactSelect = (pact: Pact) => {
    setSelectedPact(pact);
    setResult(null);
    setError(null);
    loadBalanceForPact(pact);
  };

  const handleResolve = async () => {
    if (
      !selectedPact ||
      !address ||
      !signAndSubmitTransaction ||
      currentBalance === null
    ) {
      setError("Missing required information to resolve pact");
      return;
    }

    setResolving(true);
    setError(null);

    try {
      // Parse creator address and index from pact ID
      const parts = selectedPact.id.split("-");
      const index = parseInt(parts[parts.length - 1], 10);
      const creatorAddress = parts.slice(0, -1).join("-");

      const txHash = await submitResolvePactTransaction(
        creatorAddress,
        index,
        currentBalance,
        address,
        signAndSubmitTransaction
      );

      // Determine result based on balance comparison
      const passed = currentBalance >= selectedPact.startBalance;
      setResult(passed ? "SUCCESS" : "FAILURE");

      // Refresh pacts list
      setTimeout(() => {
        router.push("/pacts");
      }, 3000);
    } catch (err: any) {
      console.error("Error resolving pact:", err);
      setError(err?.message || "Failed to resolve pact");
      setResolving(false);
    }
  };

  const activePacts = pacts.filter((p) => p.status === "ACTIVE");

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
      <div className="mb-12">
        <h2 className="text-4xl font-bold uppercase tracking-tight mb-2">
          Resolve Pact
        </h2>
        <p className="text-[#8E9094]">
          Execute the code that enforces your commitment.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] mb-4">
            Select a Pact to Resolve
          </h3>
          <p className="text-xs text-[#8E9094] mb-4">
            Anyone can resolve any pact after its deadline. Select a pact to
            check its status and resolve it.
          </p>
          <div className="space-y-3">
            {activePacts.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePactSelect(p)}
                className={`w-full text-left p-4 border transition-all ${
                  selectedPact?.id === p.id
                    ? "border-[#F26B3A] bg-[#F26B3A]/5"
                    : "border-[#23262F] hover:border-[#8E9094]"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <PactStatusBadge status={p.status} />
                  <span className="font-bold text-xs">
                    {(p.stakeAmount / 100_000_000).toFixed(2)} MOVE
                  </span>
                </div>
                <p className="font-caveat text-xl text-[#4FD1C5]">
                  &quot;Hold until{" "}
                  {new Date(p.deadline * 1000).toLocaleDateString()}&quot;
                </p>
                <p className="text-xs text-[#8E9094] mt-2">
                  Deadline: {new Date(p.deadline * 1000).toLocaleString()}
                </p>
              </button>
            ))}
            {isLoading && (
              <p className="text-sm text-[#8E9094]">Loading pacts...</p>
            )}
            {!isLoading && activePacts.length === 0 && (
              <p className="text-sm text-[#8E9094]">
                {!isConnected
                  ? "Please connect your wallet to resolve pacts."
                  : "No active pacts past their deadline to resolve."}
              </p>
            )}
          </div>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {!selectedPact ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center p-12 border border-dashed border-[#23262F] text-center"
              >
                <p className="text-[#8E9094] text-sm italic">
                  Select a pact on the left to begin verification.
                </p>
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <Card
                  className={
                    result === "SUCCESS"
                      ? "border-[#3FB950]"
                      : "border-[#E5533D]"
                  }
                >
                  <div className="text-center py-8">
                    <div className="mb-4">
                      {result === "SUCCESS" ? (
                        <div className="w-16 h-16 bg-[#3FB950] rounded-full mx-auto flex items-center justify-center text-3xl">
                          ✓
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-[#E5533D] rounded-full mx-auto flex items-center justify-center text-3xl">
                          ✕
                        </div>
                      )}
                    </div>
                    <h4
                      className={`text-3xl font-bold uppercase tracking-tighter mb-2 ${
                        result === "SUCCESS"
                          ? "text-[#3FB950]"
                          : "text-[#E5533D]"
                      }`}
                    >
                      Pact {result === "SUCCESS" ? "Verified" : "Failed"}
                    </h4>
                    <p className="text-[#8E9094] text-sm">
                      {result === "SUCCESS"
                        ? "Congratulations. Your intent was fulfilled and stake has been returned."
                        : "Protocol integrity check failed. Your stake has been slashed."}
                    </p>
                  </div>
                </Card>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedPact(null)}
                >
                  Back to Selection
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="details"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <Card className="border-[#23262F]">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] mb-4">
                    Resolution Details
                  </h4>
                  <div className="space-y-4 text-sm text-[#8E9094]">
                    <div className="flex justify-between py-2 border-b border-[#23262F]">
                      <span>Start Balance:</span>
                      <span className="text-white">
                        {selectedPact.startBalance}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#23262F]">
                      <span>Current Balance:</span>
                      <span className="text-white">
                        {currentBalance !== null
                          ? currentBalance
                          : "Loading..."}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#23262F]">
                      <span>Stake Amount:</span>
                      <span className="text-white">
                        {(selectedPact.stakeAmount / 100_000_000).toFixed(2)}{" "}
                        MOVE
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#23262F]">
                      <span>Token Address:</span>
                      <span className="text-white font-mono text-xs">
                        {selectedPact.tokenAddress.slice(0, 6)}...
                        {selectedPact.tokenAddress.slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span>Resolution Rule:</span>
                      <span className="text-[#4FD1C5]">
                        {currentBalance !== null &&
                        selectedPact.startBalance !== null
                          ? currentBalance >= selectedPact.startBalance
                            ? "PASS ✓"
                            : "FAIL ✗"
                          : "Pending"}
                      </span>
                    </div>
                  </div>
                </Card>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded text-sm">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleResolve}
                  disabled={
                    resolving || currentBalance === null || !isConnected
                  }
                >
                  {resolving ? "Resolving Pact..." : "Execute Resolution"}
                </Button>

                <p className="text-center text-[10px] uppercase tracking-widest text-[#8E9094]">
                  Resolution is irreversible once executed on-chain.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function ResolvePactPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
          <div className="p-20 text-center">
            <p className="text-[#8E9094]">Loading...</p>
          </div>
        </div>
      }
    >
      <ResolvePactPageContent />
    </Suspense>
  );
}
