"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useWallet } from "../contexts/WalletContext";
import {
  submitCreatePactTransaction,
  submitCreateGroupPactTransaction,
  initializeProtocol,
  isProtocolInitialized,
  CreatePactParams,
  getCurrentBalance,
} from "../lib/pactTransactions";

type Step = 1 | 2 | 3 | 4 | 5;

export default function CreatePactPage() {
  const router = useRouter();
  const { address, isConnected, signAndSubmitTransaction } = useWallet();
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    tokenAddress: "", // Token address (WHAT)
    minimumBalance: 0, // Minimum balance to hold (HOW MUCH)
    deadline: "", // Deadline timestamp (UNTIL WHEN)
    stake: 0, // Stake amount (SKIN IN THE GAME)
    statement: "", // Optional: Intent statement (for display only)
    isGroupPact: false, // Is this a group pact?
    maxGroupSize: 3, // Maximum group size
  });
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);

  const nextStep = () => setStep((s) => (s + 1) as Step);
  const prevStep = () => setStep((s) => (s - 1) as Step);

  const handleSubmit = async () => {
    if (!isConnected || !address || !signAndSubmitTransaction) {
      setError("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Always try to initialize if user is deployer (idempotent - safe to call multiple times)
      // The deployer address is the contract address itself
      const deployerAddress =
        "0x96920ee8aff1d21b7b877a7e92dda4df95eb8047acedfce018aab5c6b12da3a2";

      if (address.toLowerCase() === deployerAddress.toLowerCase()) {
        // User is the deployer, try to initialize (safe to call even if already initialized)
        console.log(
          "[Create Pact] User is deployer, ensuring protocol is initialized..."
        );
        console.log(
          "[Create Pact] Address match:",
          address.toLowerCase(),
          "===",
          deployerAddress.toLowerCase()
        );

        let initializationSucceeded = false;
        try {
          const initTxHash = await initializeProtocol(
            address,
            signAndSubmitTransaction
          );
          console.log(
            "[Create Pact] Initialize transaction submitted:",
            initTxHash
          );

          // Wait for initialization to complete
          await new Promise((resolve) => setTimeout(resolve, 3000));

          console.log("[Create Pact] Protocol initialization completed");
          initializationSucceeded = true;
        } catch (initError: any) {
          // If initialization fails with "already initialized", that's fine
          const errorMsg = initError?.message || initError?.toString() || "";
          console.log("[Create Pact] Initialize error:", errorMsg);

          if (
            errorMsg.includes("E_ALREADY_INITIALIZED") ||
            errorMsg.includes("0x60002") ||
            errorMsg.includes("60002")
          ) {
            console.log("[Create Pact] Protocol already initialized");
            initializationSucceeded = true;
          } else {
            // For other errors, throw - don't continue if initialization failed
            throw new Error(`Failed to initialize protocol: ${errorMsg}`);
          }
        }

        if (!initializationSucceeded) {
          throw new Error("Protocol initialization failed. Please try again.");
        }
      } else {
        // Not deployer - check if initialized
        console.log(
          "[Create Pact] User is not deployer, checking if protocol is initialized..."
        );
        const initialized = await isProtocolInitialized();
        if (!initialized) {
          throw new Error(
            `Protocol not initialized. Please contact the deployer (${deployerAddress.slice(
              0,
              6
            )}...${deployerAddress.slice(-4)}) to initialize the protocol.`
          );
        }
      }
      // Convert deadline to Unix timestamp (seconds)
      const deadlineDate = new Date(formData.deadline);
      const deadlineSeconds = Math.floor(deadlineDate.getTime() / 1000);

      // Validate deadline is in the future
      if (deadlineSeconds <= Math.floor(Date.now() / 1000)) {
        throw new Error("Deadline must be in the future");
      }

      // Validate all required fields
      if (!formData.tokenAddress) {
        throw new Error("Token address is required");
      }

      // Validate token address format (must be a valid hex address)
      // Reject type identifiers like "0x1::aptos_coin::AptosCoin"
      if (formData.tokenAddress.includes("::")) {
        throw new Error(
          "Invalid format: Type identifiers (like '0x1::aptos_coin::AptosCoin') are not supported. " +
            "Please enter a wallet address (e.g., your address: " +
            address?.slice(0, 10) +
            "...) to track MOVE balance."
        );
      }

      const addressPattern = /^0x[0-9a-fA-F]{1,64}$/;
      if (!addressPattern.test(formData.tokenAddress)) {
        throw new Error(
          "Invalid address format. Must be a valid address (0x followed by hex characters). " +
            "For MVP, use your wallet address to track MOVE balance."
        );
      }

      if (formData.minimumBalance <= 0) {
        throw new Error("Minimum balance must be greater than 0");
      }

      if (!formData.deadline) {
        throw new Error("Deadline is required");
      }

      // Convert stake amount to octas (1 MOVE = 100,000,000 octas)
      const stakeAmountOctas = Math.floor(formData.stake * 100_000_000);

      // Minimum stake check (0.01 MOVE = 1,000,000 octas)
      if (stakeAmountOctas < 1_000_000) {
        throw new Error("Minimum stake is 0.01 MOVE");
      }

      // Convert minimum balance to octas (assuming 8 decimals for now)
      // TODO: Fetch token decimals from contract
      const minimumBalanceOctas = Math.floor(
        formData.minimumBalance * 100_000_000
      );

      const params: CreatePactParams = {
        tokenAddress: formData.tokenAddress,
        startBalance: minimumBalanceOctas, // This is the minimum balance they commit to hold
        stakeAmount: stakeAmountOctas,
        deadlineSeconds: deadlineSeconds,
      };

      console.log("[Create Pact] Submitting transaction with params:", params);

      // Submit transaction
      if (!signAndSubmitTransaction) {
        throw new Error("No valid wallet connection");
      }

      // Submit transaction
      let txHash: string;
      if (formData.isGroupPact) {
        txHash = await submitCreateGroupPactTransaction(
          { ...params, maxGroupSize: formData.maxGroupSize },
          address,
          signAndSubmitTransaction
        );
      } else {
        txHash = await submitCreatePactTransaction(
          params,
          address,
          signAndSubmitTransaction
        );
      }

      console.log("[Create Pact] Transaction successful:", txHash);

      // Redirect to pacts page on success
      router.push(`/pacts?tx=${txHash}`);
    } catch (err: any) {
      console.error("[Create Pact] Error:", err);
      setError(err?.message || "Failed to create pact. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, name: "Token" },
    { id: 2, name: "Minimum Balance" },
    { id: 3, name: "Deadline" },
    { id: 4, name: "Stake" },
    { id: 5, name: "Review" },
  ];

  // Fetch current balance when token address is provided
  useEffect(() => {
    const fetchBalance = async () => {
      if (!formData.tokenAddress || !address) {
        setCurrentBalance(null);
        return;
      }

      try {
        // For now, we'll fetch MOVE balance as a reference
        // TODO: Fetch actual token balance based on token address
        const balance = await getCurrentBalance(address);
        setCurrentBalance(balance);
      } catch (error) {
        console.error("Error fetching balance:", error);
        setCurrentBalance(null);
      }
    };

    if (address) {
      fetchBalance();
    }
  }, [formData.tokenAddress, address]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
      <div className="mb-12">
        <h2 className="text-3xl font-bold uppercase tracking-tight mb-4">
          Create New Pact
        </h2>
        <div className="flex items-center gap-2">
          {steps.map((s) => (
            <React.Fragment key={s.id}>
              <div
                className={`w-3 h-3 rounded-full ${
                  step >= s.id ? "bg-[#F26B3A]" : "bg-[#23262F]"
                }`}
              />
              {s.id !== 5 && (
                <div
                  className={`flex-1 h-[2px] ${
                    step > s.id ? "bg-[#F26B3A]" : "bg-[#23262F]"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {step === 1 && (
            <div className="space-y-6">
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2">1️⃣ Pact Type</h3>
                <p className="text-sm text-[#8E9094] mb-4">
                  Choose between a solo pact or a group pact where multiple
                  users join together.
                </p>
              </div>
              <div className="space-y-4">
                <label className="flex items-center gap-3 p-4 border border-[#23262F] rounded cursor-pointer hover:border-[#F26B3A] transition-colors">
                  <input
                    type="radio"
                    name="pactType"
                    checked={!formData.isGroupPact}
                    onChange={() =>
                      setFormData({ ...formData, isGroupPact: false })
                    }
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-bold">Solo Pact</p>
                    <p className="text-xs text-[#8E9094]">
                      Individual commitment
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-4 border border-[#23262F] rounded cursor-pointer hover:border-[#F26B3A] transition-colors">
                  <input
                    type="radio"
                    name="pactType"
                    checked={formData.isGroupPact}
                    onChange={() =>
                      setFormData({ ...formData, isGroupPact: true })
                    }
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-bold">Group Pact</p>
                    <p className="text-xs text-[#8E9094]">
                      Multiple users join the same pact
                    </p>
                  </div>
                </label>
              </div>
              {formData.isGroupPact && (
                <div>
                  <label className="block">
                    <span className="text-sm uppercase font-bold tracking-widest text-[#8E9094] mb-2 block">
                      Maximum Group Size
                    </span>
                    <input
                      type="number"
                      min="2"
                      max="10"
                      className="w-full bg-[#15171C] border border-[#23262F] p-4 text-white focus:outline-none focus:border-[#F26B3A]"
                      value={formData.maxGroupSize}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxGroupSize: Number(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-[#8E9094] mt-1">
                      How many members can join (including you)
                    </p>
                  </label>
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2">Asset (WHAT)</h3>
                <p className="text-sm text-[#8E9094] mb-4">
                  Enter the token address you want to track. This is the token
                  you commit to hold.
                </p>
              </div>
              <label className="block">
                <span className="text-sm uppercase font-bold tracking-widest text-[#8E9094] mb-2 block">
                  Token Address *
                </span>
                <input
                  autoFocus
                  type="text"
                  className="w-full bg-[#15171C] border border-[#23262F] p-4 text-white font-mono focus:outline-none focus:border-[#F26B3A]"
                  placeholder={address || "0x..."}
                  value={formData.tokenAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tokenAddress: e.target.value.trim(),
                    })
                  }
                />
                <div className="mt-2 space-y-1">
                  {address && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, tokenAddress: address })
                      }
                      className="text-xs text-[#F26B3A] hover:underline"
                    >
                      Use my wallet address ({address.slice(0, 6)}...
                      {address.slice(-4)})
                    </button>
                  )}
                  {currentBalance !== null && (
                    <p className="text-xs text-[#8E9094]">
                      Current MOVE balance:{" "}
                      {(currentBalance / 100_000_000).toFixed(2)} MOVE
                    </p>
                  )}
                  <p className="text-xs text-[#8E9094]">
                    <strong>Note:</strong> For MVP, enter your wallet address to
                    track your MOVE balance. Must be a valid address (0x
                    followed by hex characters).
                  </p>
                </div>
              </label>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex-1"
                  disabled={!formData.tokenAddress}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2">
                  2️⃣ Minimum Balance (HOW MUCH)
                </h3>
                <p className="text-sm text-[#8E9094] mb-4">
                  Enter the minimum amount you commit to hold. If your balance
                  drops below this at the deadline, the pact fails.
                </p>
              </div>
              <label className="block">
                <span className="text-sm uppercase font-bold tracking-widest text-[#8E9094] mb-2 block">
                  Minimum Balance to Hold *
                </span>
                <div className="flex items-center gap-4">
                  <input
                    autoFocus
                    type="number"
                    step="0.00000001"
                    className="w-full bg-[#15171C] border border-[#23262F] p-4 text-3xl font-bold text-white text-center focus:outline-none focus:border-[#F26B3A]"
                    placeholder="0.00"
                    value={formData.minimumBalance || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minimumBalance: Number(e.target.value),
                      })
                    }
                  />
                  <span className="text-xl font-bold text-[#F26B3A]">MOVE</span>
                </div>
                {currentBalance !== null && (
                  <p className="text-xs text-[#8E9094] mt-2">
                    Your current balance:{" "}
                    {(currentBalance / 100_000_000).toFixed(2)} MOVE
                  </p>
                )}
              </label>
              <div className="flex gap-4">
                <Button variant="outline" onClick={prevStep} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex-1"
                  disabled={
                    !formData.minimumBalance || formData.minimumBalance <= 0
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2">
                  3️⃣ Duration (UNTIL WHEN)
                </h3>
                <p className="text-sm text-[#8E9094] mb-4">
                  When does this commitment end? After this time, the pact can
                  be resolved.
                </p>
              </div>
              <label className="block">
                <span className="text-sm uppercase font-bold tracking-widest text-[#8E9094] mb-2 block">
                  Deadline *
                </span>
                <input
                  autoFocus
                  type="datetime-local"
                  className="w-full bg-[#15171C] border border-[#23262F] p-4 text-white focus:outline-none focus:border-[#F26B3A]"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                />
              </label>
              <div className="flex gap-4">
                <Button variant="outline" onClick={prevStep} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex-1"
                  disabled={!formData.deadline}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2">
                  4️⃣ Stake / Penalty (SKIN IN THE GAME)
                </h3>
                <p className="text-sm text-[#8E9094] mb-4">
                  How much MOVE are you staking? If you break the pact (balance
                  drops below minimum), this will be slashed (90% returned to
                  you, 10% protocol fee).
                </p>
              </div>
              <div className="bg-[#15171C] border border-[#23262F] p-8 text-center">
                <span className="text-sm uppercase font-bold tracking-widest text-[#8E9094] mb-4 block">
                  Stake Amount *
                </span>
                <div className="flex items-center justify-center gap-4">
                  <input
                    type="number"
                    autoFocus
                    step="0.01"
                    className="bg-transparent text-5xl font-bold text-white text-center w-full focus:outline-none"
                    value={formData.stake || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stake: Number(e.target.value),
                      })
                    }
                    placeholder="0.00"
                  />
                  <span className="text-2xl font-bold text-[#F26B3A]">
                    MOVE
                  </span>
                </div>
                <p className="text-xs text-[#8E9094] mt-4">
                  Minimum: 0.01 MOVE
                </p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" onClick={prevStep} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex-1"
                  disabled={!formData.stake || formData.stake < 0.01}
                >
                  Review
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-8">
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">Review Your Pact</h3>
                <p className="text-sm text-[#8E9094]">
                  Verify all parameters before creating. This commitment is
                  enforceable on-chain.
                </p>
              </div>

              <Card className="border-[#F26B3A]">
                <div className="space-y-6">
                  {/* Optional Intent Statement */}
                  {formData.statement && (
                    <div className="pb-4 border-b border-[#23262F]">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
                        Intent Statement (Optional - for display only)
                      </span>
                      <p className="text-lg font-caveat text-[#4FD1C5]">
                        &quot;{formData.statement}&quot;
                      </p>
                    </div>
                  )}

                  {/* Required Parameters */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-1">
                        1. Asset (WHAT)
                      </span>
                      <p className="font-mono text-sm break-all">
                        {formData.tokenAddress}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-1">
                        2. Minimum Balance (HOW MUCH)
                      </span>
                      <p className="font-bold text-xl">
                        ≥ {formData.minimumBalance} MOVE
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-1">
                        3. Duration (UNTIL WHEN)
                      </span>
                      <p className="font-bold">
                        {new Date(formData.deadline).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-1">
                        4. Stake / Penalty (SKIN IN THE GAME)
                      </span>
                      <p className="font-bold text-xl text-[#F26B3A]">
                        {formData.stake} MOVE
                      </p>
                      <p className="text-xs text-[#8E9094] mt-1">
                        {formData.isGroupPact
                          ? `Group pact: If any member breaks, their stake is redistributed or burned. Max group size: ${formData.maxGroupSize}`
                          : `If balance drops below ${formData.minimumBalance} MOVE at deadline, this stake will be slashed (90% returned, 10% protocol fee)`}
                      </p>
                    </div>
                    {formData.isGroupPact && (
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-1">
                          5. Group Pact Settings
                        </span>
                        <p className="text-sm">
                          Maximum Group Size: {formData.maxGroupSize} members
                        </p>
                        <p className="text-xs text-[#8E9094] mt-1">
                          Other users can join this pact after creation. All
                          members must hold their balance or face penalties.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Optional: Add Intent Statement */}
              {!formData.statement && (
                <div className="border border-dashed border-[#23262F] p-4 rounded">
                  <label className="block">
                    <span className="text-xs uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
                      Add Intent Statement (Optional)
                    </span>
                    <textarea
                      className="w-full bg-[#15171C] border border-[#23262F] p-3 text-sm font-caveat text-[#4FD1C5] focus:outline-none focus:border-[#F26B3A] min-h-[80px]"
                      placeholder="e.g., 'I'm holding because I believe in the long-term vision' (for display only, not enforced)"
                      value={formData.statement}
                      onChange={(e) =>
                        setFormData({ ...formData, statement: e.target.value })
                      }
                    />
                    <p className="text-xs text-[#8E9094] mt-2">
                      This is for social signaling only. The contract only
                      checks the 4 parameters above.
                    </p>
                  </label>
                </div>
              )}
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded">
                  {error}
                </div>
              )}
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1"
                  disabled={isSubmitting || !isConnected}
                >
                  {isSubmitting ? "Creating Pact..." : "Confirm & Sign"}
                </Button>
              </div>
              {!isConnected && (
                <p className="text-sm text-[#8E9094] text-center">
                  Please connect your wallet to create a pact
                </p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
