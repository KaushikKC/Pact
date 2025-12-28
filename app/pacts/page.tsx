"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card } from "../components/ui/card";
import { PactStatusBadge } from "../components/pact/pact-status-badge";
import { useWallet } from "../contexts/WalletContext";
import { fetchUserPacts } from "../lib/pactTransactions";

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
  // UI fields (derived from onchain data)
  statement?: string;
  type?: string;
  token?: string;
}

export default function MyPactsPage() {
  const { address, isConnected } = useWallet();
  const [filter, setFilter] = useState<PactStatus | "ALL">("ALL");
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch pacts from contract
  useEffect(() => {
    const loadPacts = async () => {
      if (!isConnected || !address) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const fetchedPacts = await fetchUserPacts(address);

        // Transform contract data to UI format
        const transformedPacts: Pact[] = fetchedPacts.map((pact, index) => ({
          id: `${pact.creator}-${pact.index}`,
          index: pact.index,
          tokenAddress: pact.tokenAddress,
          startBalance: pact.startBalance,
          stakeAmount: pact.stakeAmount,
          deadline: pact.deadline,
          status: getStatusFromCode(pact.status),
          creator: pact.creator,
          // Generate statement from contract data
          statement: `Hold ≥ ${(pact.startBalance / 100_000_000).toFixed(
            2
          )} MOVE until ${new Date(pact.deadline * 1000).toLocaleDateString()}`,
          type: "HOLD",
          token: "MOVE",
        }));

        setPacts(transformedPacts);
      } catch (err: any) {
        console.error("Error loading pacts:", err);
        setError(err?.message || "Failed to load pacts");
      } finally {
        setIsLoading(false);
      }
    };

    loadPacts();
  }, [address, isConnected]);

  const getStatusFromCode = (code: number): PactStatus => {
    if (code === 0) return "ACTIVE";
    if (code === 1) return "PASSED";
    if (code === 2) return "FAILED";
    return "ACTIVE";
  };

  const filteredPacts =
    filter === "ALL" ? pacts : pacts.filter((p) => p.status === filter);

  const filters: (PactStatus | "ALL")[] = ["ALL", "ACTIVE", "PASSED", "FAILED"];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-bold uppercase tracking-tight mb-2">
            My Pacts
          </h2>
          <p className="text-[#8E9094]">
            Manage your commitments and check status.
          </p>
        </div>

        <div className="flex gap-2 bg-[#15171C] p-1 border border-[#23262F]">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                filter === f
                  ? "bg-[#F26B3A] text-[#0E0F12]"
                  : "text-[#8E9094] hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="py-20 text-center">
          <p className="text-[#8E9094]">Loading your pacts...</p>
        </div>
      )}

      {error && (
        <div className="py-20 text-center border border-red-500/50 bg-red-500/10">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-[#F26B3A] font-bold uppercase text-xs tracking-widest"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && !isConnected && (
        <div className="py-20 text-center border border-dashed border-[#23262F]">
          <p className="text-[#8E9094] mb-4">
            Please connect your wallet to view your pacts.
          </p>
        </div>
      )}

      {!isLoading && !error && isConnected && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPacts.map((pact, idx) => (
            <motion.div
              key={pact.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link href={`/pacts/${pact.id}`}>
                <Card className="h-full flex flex-col justify-between group">
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-bold tracking-widest text-[#8E9094] uppercase">
                        {pact.type}
                      </span>
                      <PactStatusBadge status={pact.status} />
                    </div>
                    <h3 className="text-2xl font-caveat text-[#4FD1C5] line-clamp-2">
                      &quot;{pact.statement}&quot;
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-t border-[#23262F] pt-4">
                      <div>
                        <p className="text-[10px] font-bold tracking-widest text-[#8E9094] uppercase mb-1">
                          Stake
                        </p>
                        <p className="font-bold text-lg">
                          {(pact.stakeAmount / 100_000_000).toFixed(2)}{" "}
                          {pact.token || "MOVE"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold tracking-widest text-[#8E9094] uppercase mb-1">
                          Ends
                        </p>
                        <p className="font-medium text-sm text-white/70">
                          {new Date(pact.deadline * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] uppercase font-bold tracking-widest text-[#F26B3A] opacity-0 group-hover:opacity-100 transition-opacity">
                      View Details →
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && !error && isConnected && filteredPacts.length === 0 && (
        <div className="py-20 text-center border border-dashed border-[#23262F]">
          <p className="text-[#8E9094] mb-4">
            No pacts found matching this filter.
          </p>
          <Link href="/create">
            <button className="text-[#F26B3A] font-bold uppercase text-xs tracking-widest">
              Create One Now
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
