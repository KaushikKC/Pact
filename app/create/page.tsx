"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useWallet } from "../contexts/WalletContext";
import {
  submitCreatePactTransaction,
  initializeProtocol,
  isProtocolInitialized,
  CreatePactParams,
} from "../lib/pactTransactions";

type Step = 1 | 2 | 3 | 4;

export default function CreatePactPage() {
  const router = useRouter();
  const { address, isConnected, signAndSubmitTransaction } = useWallet();
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: "HOLD" as "HOLD" | "SHIP" | "ATTEND",
    statement: "",
    stake: 0,
    token: "MOVE",
    deadline: "",
    tokenAddress: "", // Address of token to track (for MVP: can be user's address or a token address)
  });

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
        "0x0ded5b8d5d47739ce0022d24bd2d20f32eb97dcdc1dd2db583f4cc5e608c4794";

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

      // Convert stake amount to octas (1 MOVE = 100,000,000 octas)
      const stakeAmountOctas = Math.floor(formData.stake * 100_000_000);

      // Minimum stake check (0.01 MOVE = 1,000,000 octas)
      if (stakeAmountOctas < 1_000_000) {
        throw new Error("Minimum stake is 0.01 MOVE");
      }

      // For MVP: Use the user's address as token address (they're committing to hold their own balance)
      // In production, this would be the address of the token they're committing to hold
      const tokenAddress = formData.tokenAddress || address;

      // Get current balance (for MVP, we'll use a placeholder - in production, fetch actual token balance)
      // For now, we'll use 0 as start balance (the contract will check the actual balance)
      const startBalance = 0; // TODO: Fetch actual token balance from chain

      const params: CreatePactParams = {
        tokenAddress,
        startBalance,
        stakeAmount: stakeAmountOctas,
        deadlineSeconds: deadlineSeconds,
      };

      console.log("[Create Pact] Submitting transaction with params:", params);

      // Submit transaction
      if (!signAndSubmitTransaction) {
        throw new Error("No valid wallet connection");
      }

      // Submit transaction
      const txHash = await submitCreatePactTransaction(
        params,
        address,
        signAndSubmitTransaction
      );

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
    { id: 1, name: "Intent Type" },
    { id: 2, name: "Statement" },
    { id: 3, name: "Stake" },
    { id: 4, name: "Review" },
  ];

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
              {s.id !== 4 && (
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
              <p className="text-[#8E9094] mb-8">
                What type of commitment are you making?
              </p>
              <div className="grid gap-4">
                {(["HOLD", "SHIP", "ATTEND"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setFormData({ ...formData, type: t });
                      nextStep();
                    }}
                    className={`p-6 text-left border transition-all ${
                      formData.type === t
                        ? "border-[#F26B3A] bg-[#F26B3A]/5"
                        : "border-[#23262F] hover:border-[#8E9094]"
                    }`}
                  >
                    <span className="block text-xl font-bold uppercase mb-1">
                      {t}
                    </span>
                    <span className="text-sm text-[#8E9094]">
                      {t === "HOLD" &&
                        "I will hold specific tokens until a date."}
                      {t === "SHIP" && "I will complete and release a project."}
                      {t === "ATTEND" &&
                        "I will be physically present at an event."}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <label className="block">
                <span className="text-sm uppercase font-bold tracking-widest text-[#8E9094] mb-2 block">
                  The Intent Statement
                </span>
                <textarea
                  autoFocus
                  className="w-full bg-[#15171C] border border-[#23262F] p-4 text-2xl font-caveat text-[#4FD1C5] focus:outline-none focus:border-[#F26B3A] min-h-[150px]"
                  placeholder="I will not sell my MOVE until..."
                  value={formData.statement}
                  onChange={(e) =>
                    setFormData({ ...formData, statement: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm uppercase font-bold tracking-widest text-[#8E9094] mb-2 block">
                  Deadline
                </span>
                <input
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
                  disabled={!formData.statement || !formData.deadline}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <div className="bg-[#15171C] border border-[#23262F] p-8 text-center">
                <span className="text-sm uppercase font-bold tracking-widest text-[#8E9094] mb-4 block">
                  Stake Amount
                </span>
                <div className="flex items-center justify-center gap-4">
                  <input
                    type="number"
                    autoFocus
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
                    {formData.token}
                  </span>
                </div>
              </div>
              <p className="text-center text-sm text-[#8E9094]">
                If you fail this pact, your stake will be slashed according to
                protocol rules.
              </p>
              <div className="flex gap-4">
                <Button variant="outline" onClick={prevStep} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex-1"
                  disabled={!formData.stake}
                >
                  Review
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8">
              <Card className="border-[#F26B3A]">
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-1">
                      Type: {formData.type}
                    </span>
                    <h3 className="text-3xl font-caveat text-[#4FD1C5]">
                      &quot;{formData.statement}&quot;
                    </h3>
                  </div>
                  <div className="flex justify-between border-t border-[#23262F] pt-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-1">
                        Staking
                      </span>
                      <span className="font-bold text-xl">
                        {formData.stake} {formData.token}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-1">
                        Ends
                      </span>
                      <span className="font-bold">
                        {new Date(formData.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
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
