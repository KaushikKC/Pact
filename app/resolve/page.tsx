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
  isGroup?: boolean;
  groupMembers?: string[];
}

function ResolvePactPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected, signAndSubmitTransaction } = useWallet();
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPact, setSelectedPact] = useState<Pact | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [memberBalances, setMemberBalances] = useState<number[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
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
            isGroup: pact.isGroup || false,
            groupMembers: pact.groupMembers || [],
          }));

        setPacts(activePactsData);
        console.log(
          `[Resolve Page] Found ${activePactsData.length} resolvable pacts`
        );
      } catch (err: unknown) {
        console.error("Error loading pacts:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load pacts";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadActivePacts();
  }, []);

  // Load specific pact from URL param
  useEffect(() => {
    const loadPactFromUrl = async () => {
      const pactId = searchParams?.get("pact");
      if (!pactId) return;

      // If pacts are already loaded, use them
      if (pacts.length > 0) {
        const pact = pacts.find((p) => p.id === pactId);
        if (pact) {
          // For group pacts, ensure we have group members loaded
          if (
            pact.isGroup &&
            (!pact.groupMembers || pact.groupMembers.length === 0)
          ) {
            // Fetch full pact details including group members
            try {
              const parts = pactId.split("-");
              const index = parseInt(parts[parts.length - 1], 10);
              const creatorAddress = parts.slice(0, -1).join("-");
              const fullPact = await fetchPact(creatorAddress, index);
              if (fullPact) {
                const updatedPact: Pact = {
                  ...pact,
                  isGroup: fullPact.isGroup || false,
                  groupMembers: fullPact.groupMembers || [],
                };
                setSelectedPact(updatedPact);
                loadBalanceForPact(updatedPact);
              } else {
                setSelectedPact(pact);
                loadBalanceForPact(pact);
              }
            } catch (err) {
              console.error("Error fetching full pact details:", err);
              setSelectedPact(pact);
              loadBalanceForPact(pact);
            }
          } else {
            setSelectedPact(pact);
            loadBalanceForPact(pact);
          }
        }
      } else {
        // If pacts not loaded yet, fetch this specific pact
        try {
          const parts = pactId.split("-");
          const index = parseInt(parts[parts.length - 1], 10);
          const creatorAddress = parts.slice(0, -1).join("-");
          const fullPact = await fetchPact(creatorAddress, index);
          if (fullPact) {
            const statusMap: Record<number, PactStatus> = {
              0: "ACTIVE",
              1: "PASSED",
              2: "FAILED",
            };
            const pactData: Pact = {
              id: `${fullPact.creator}-${fullPact.index}`,
              index: fullPact.index,
              tokenAddress: fullPact.tokenAddress,
              startBalance: fullPact.startBalance,
              stakeAmount: fullPact.stakeAmount,
              deadline: fullPact.deadline,
              status: statusMap[fullPact.status] || "ACTIVE",
              creator: fullPact.creator,
              isGroup: fullPact.isGroup || false,
              groupMembers: fullPact.groupMembers || [],
            };
            setSelectedPact(pactData);
            loadBalanceForPact(pactData);
          }
        } catch (err) {
          console.error("Error loading pact from URL:", err);
        }
      }
    };

    loadPactFromUrl();
  }, [searchParams, pacts]);

  // Load current balance for selected pact
  const loadBalanceForPact = async (pact: Pact) => {
    setLoadingBalances(true);
    setError(null);

    try {
      if (pact.isGroup) {
        // For group pacts, ensure we have group members
        let members = pact.groupMembers || [];

        // If no members loaded, fetch them
        if (members.length === 0) {
          console.log("[Resolve Page] Group members not loaded, fetching...");
          try {
            const fullPact = await fetchPact(pact.creator, pact.index);
            if (
              fullPact &&
              fullPact.groupMembers &&
              fullPact.groupMembers.length > 0
            ) {
              members = fullPact.groupMembers;
              // Update pact with group members
              setSelectedPact({
                ...pact,
                groupMembers: members,
              });
            }
          } catch (err) {
            console.error("Error fetching group members:", err);
            setError("Failed to load group members");
            setLoadingBalances(false);
            return;
          }
        }

        if (members.length > 0) {
          // Filter out invalid members (concatenated addresses)
          const validMembers = members.filter(
            (m) =>
              m &&
              typeof m === "string" &&
              m.startsWith("0x") &&
              !m.includes(",") &&
              !m.includes("%2C") &&
              m.length > 10
          );

          if (validMembers.length === 0) {
            console.warn("[Resolve Page] No valid group members found");
            setError("No valid group members found");
            setMemberBalances([]);
            setCurrentBalance(null);
            setLoadingBalances(false);
            return;
          }

          console.log(
            "[Resolve Page] Fetching balances for",
            validMembers.length,
            "group members:",
            validMembers
          );

          // For group pacts, fetch balances for all members in parallel with timeout
          const balancePromises = validMembers.map(async (member) => {
            try {
              // Add timeout to prevent hanging
              const balancePromise = getCurrentBalance(member);
              const timeoutPromise = new Promise<number>((resolve) => {
                setTimeout(() => resolve(0), 10000); // 10 second timeout
              });
              return await Promise.race([balancePromise, timeoutPromise]);
            } catch (err) {
              console.error(`Error fetching balance for ${member}:`, err);
              return 0; // Return 0 if balance fetch fails
            }
          });

          const balances = await Promise.all(balancePromises);

          setMemberBalances(balances);
          setCurrentBalance(null); // Not used for group pacts
          console.log(
            "[Resolve Page] Group pact member balances loaded:",
            balances
          );
        } else {
          console.warn("[Resolve Page] No group members found for group pact");
          setError("Group members not found");
          setMemberBalances([]);
          setCurrentBalance(null);
        }
      } else {
        // For solo pacts, fetch balance for creator
        const balance = await getCurrentBalance(pact.creator);
        setCurrentBalance(balance);
        setMemberBalances([]);
      }
    } catch (err: unknown) {
      console.error("Error loading balance:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load current balance";
      setError(errorMessage);
    } finally {
      setLoadingBalances(false);
    }
  };

  const handlePactSelect = (pact: Pact) => {
    setSelectedPact(pact);
    setResult(null);
    setError(null);
    loadBalanceForPact(pact);
  };

  const handleResolve = async () => {
    if (!selectedPact || !address || !signAndSubmitTransaction) {
      setError("Missing required information to resolve pact");
      return;
    }

    // Validate balances based on pact type
    if (selectedPact.isGroup) {
      if (
        memberBalances.length === 0 ||
        memberBalances.length !== (selectedPact.groupMembers?.length || 0)
      ) {
        setError("Missing member balances for group pact");
        return;
      }
    } else {
      if (currentBalance === null) {
        setError("Missing current balance");
        return;
      }
    }

    setResolving(true);
    setError(null);

    try {
      // Parse creator address and index from pact ID
      const parts = selectedPact.id.split("-");
      const index = parseInt(parts[parts.length - 1], 10);
      const creatorAddress = parts.slice(0, -1).join("-");

      // Ensure we have valid balance values
      const balanceValue: number | number[] = selectedPact.isGroup
        ? memberBalances
        : currentBalance !== null
        ? currentBalance
        : 0; // Fallback (should never happen due to validation above)

      await submitResolvePactTransaction(
        creatorAddress,
        index,
        balanceValue,
        address,
        signAndSubmitTransaction,
        selectedPact.isGroup || false,
        memberBalances
      );

      // Determine result based on balance comparison
      // For group pacts, all members must pass; for solo pacts, just check creator
      let passed = false;
      if (selectedPact.isGroup && memberBalances.length > 0) {
        // All members must maintain their start balance
        passed = memberBalances.every((balance) => {
          // For group pacts, we'd need to check each member's start balance
          // For now, assume all members have the same start balance requirement
          return balance >= selectedPact.startBalance;
        });
      } else if (currentBalance !== null) {
        passed = currentBalance >= selectedPact.startBalance;
      }
      setResult(passed ? "SUCCESS" : "FAILURE");

      // Refresh pacts list
      setTimeout(() => {
        router.push("/pacts");
      }, 3000);
    } catch (err: unknown) {
      console.error("Error resolving pact:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resolve pact";
      setError(errorMessage);
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
                  &quot;Hold ≥ {(p.startBalance / 100_000_000).toFixed(2)} MOVE
                  until {new Date(p.deadline * 1000).toLocaleDateString()}&quot;
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
                  {loadingBalances && (
                    <div className="mb-4 p-3 bg-[#15171C] border border-[#23262F] rounded">
                      <p className="text-xs text-[#8E9094]">
                        {selectedPact.isGroup
                          ? `Loading balances for ${
                              selectedPact.groupMembers?.length || 0
                            } group members...`
                          : "Loading current balance..."}
                      </p>
                    </div>
                  )}
                  <div className="space-y-4 text-sm text-[#8E9094]">
                    <div className="flex justify-between py-2 border-b border-[#23262F]">
                      <span>Minimum Balance (Committed):</span>
                      <span className="text-white">
                        {(selectedPact.startBalance / 100_000_000).toFixed(2)}{" "}
                        MOVE
                      </span>
                    </div>
                    {selectedPact.isGroup ? (
                      <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-[#23262F]">
                          <span>Group Member Balances:</span>
                          <span className="text-white">
                            {loadingBalances
                              ? "Loading..."
                              : memberBalances.length > 0
                              ? `${memberBalances.length} loaded`
                              : "Not loaded"}
                          </span>
                        </div>
                        {memberBalances.length > 0 && (
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {selectedPact.groupMembers?.map((member, idx) => (
                              <div
                                key={member}
                                className="flex justify-between py-1 text-xs"
                              >
                                <span className="font-mono">
                                  {member.slice(0, 6)}...{member.slice(-4)}:
                                </span>
                                <span className="text-white">
                                  {memberBalances[idx] !== undefined
                                    ? `${(
                                        memberBalances[idx] / 100_000_000
                                      ).toFixed(2)} MOVE`
                                    : "N/A"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-between py-2 border-b border-[#23262F]">
                        <span>Current Balance:</span>
                        <span className="text-white">
                          {loadingBalances
                            ? "Loading..."
                            : currentBalance !== null
                            ? `${(currentBalance / 100_000_000).toFixed(
                                2
                              )} MOVE`
                            : "Not loaded"}
                        </span>
                      </div>
                    )}
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
                      <span className="text-[#4FD1C5] font-bold">
                        {loadingBalances
                          ? "Loading..."
                          : selectedPact.isGroup
                          ? memberBalances.length > 0 &&
                            selectedPact.groupMembers?.length ===
                              memberBalances.length
                            ? memberBalances.every(
                                (bal) => bal >= selectedPact.startBalance
                              )
                              ? "PASS ✓ (All Balances ≥ Minimum)"
                              : "FAIL ✗ (Some Balances < Minimum)"
                            : "Pending"
                          : currentBalance !== null &&
                            selectedPact.startBalance !== null
                          ? currentBalance >= selectedPact.startBalance
                            ? "PASS ✓ (Balance ≥ Minimum)"
                            : "FAIL ✗ (Balance < Minimum)"
                          : "Pending"}
                      </span>
                    </div>
                    <div className="mt-2 p-2 bg-[#23262F] rounded text-xs text-[#8E9094]">
                      <strong>Rule:</strong> current_balance ≥{" "}
                      {(selectedPact.startBalance / 100_000_000).toFixed(2)}{" "}
                      MOVE = PASS
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
                    resolving ||
                    loadingBalances ||
                    !isConnected ||
                    (selectedPact.isGroup
                      ? memberBalances.length === 0 ||
                        memberBalances.length !==
                          (selectedPact.groupMembers?.length || 0)
                      : currentBalance === null)
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
