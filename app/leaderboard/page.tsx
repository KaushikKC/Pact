"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "../components/ui/card";
import { PactStatusBadge } from "../components/pact/pact-status-badge";
import { useWallet } from "../contexts/WalletContext";
import {
  fetchAllPacts,
  getProtocolStats,
  getUserStats,
} from "../lib/pactTransactions";
import { getWatchlist } from "../lib/watchlist";

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

type ReputationFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";
type ViewFilter = "ALL" | "WATCHLIST";

export default function LeaderboardPage() {
  const { address, isConnected } = useWallet();
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [allPacts, setAllPacts] = useState<Pact[]>([]);
  const [stats, setStats] = useState({
    totalPacts: 0,
    protocolFees: 0,
    totalVolume: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reputationFilter, setReputationFilter] =
    useState<ReputationFilter>("ALL");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("ALL");
  const [userReputations, setUserReputations] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Load ALL pacts from ALL users first
        console.log("[Leaderboard] Fetching all pacts...");
        const allPacts = await fetchAllPacts();
        console.log("[Leaderboard] Fetched pacts:", allPacts.length);

        // Load protocol stats (includes total volume calculation)
        console.log("[Leaderboard] Fetching protocol stats...");
        const protocolStats = await getProtocolStats();
        console.log("[Leaderboard] Protocol stats:", protocolStats);
        setStats(protocolStats);

        const transformedPacts: Pact[] = allPacts.map((pact) => {
          const statusMap: Record<number, PactStatus> = {
            0: "ACTIVE",
            1: "PASSED",
            2: "FAILED",
          };
          return {
            id: `${pact.creator}-${pact.index}`,
            index: pact.index,
            tokenAddress: pact.tokenAddress,
            startBalance: pact.startBalance,
            stakeAmount: pact.stakeAmount,
            deadline: pact.deadline,
            status: statusMap[pact.status] || "ACTIVE",
            creator: pact.creator,
          };
        });

        // Sort by stake amount (descending)
        transformedPacts.sort((a, b) => b.stakeAmount - a.stakeAmount);
        setAllPacts(transformedPacts);
        setPacts(transformedPacts);

        // Load reputation scores for all unique creators
        const uniqueCreators = Array.from(
          new Set(transformedPacts.map((p) => p.creator))
        );
        const reputationMap: Record<string, number> = {};
        await Promise.all(
          uniqueCreators.map(async (creator) => {
            try {
              const userStats = await getUserStats(creator);
              reputationMap[creator] = userStats.reputationScore;
            } catch (error) {
              console.error(`Error fetching reputation for ${creator}:`, error);
              reputationMap[creator] = 0;
            }
          })
        );
        setUserReputations(reputationMap);
      } catch (err: any) {
        console.error("Error loading leaderboard data:", err);
        setError(err?.message || "Failed to load leaderboard data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate derived stats
  const activePactsCount = pacts.filter((p) => p.status === "ACTIVE").length;
  const passedPactsCount = pacts.filter((p) => p.status === "PASSED").length;
  const failedPactsCount = pacts.filter((p) => p.status === "FAILED").length;
  const successRate =
    passedPactsCount + failedPactsCount > 0
      ? (
          (passedPactsCount / (passedPactsCount + failedPactsCount)) *
          100
        ).toFixed(1)
      : "0.0";

  // Use total volume from stats (calculated from all pacts)
  const totalVolumeMOVE = (stats.totalVolume / 100_000_000).toFixed(2);
  const protocolFeesMOVE = (stats.protocolFees / 100_000_000).toFixed(2);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
      <div className="mb-12">
        <h2 className="text-4xl font-bold uppercase tracking-tight mb-2">
          Protocol Pulse
        </h2>
        <p className="text-[#8E9094]">
          Community commitments and global proof of integrity.
        </p>
      </div>

      {isLoading && (
        <div className="py-20 text-center">
          <p className="text-[#8E9094]">Loading protocol stats...</p>
        </div>
      )}

      {error && (
        <div className="py-20 text-center border border-red-500/50 bg-red-500/10">
          <p className="text-red-400 mb-4">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
                Total Volume
              </span>
              <span className="text-2xl font-bold text-[#F26B3A]">
                {totalVolumeMOVE} MOVE
              </span>
            </Card>
            <Card className="text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
                Total Pacts
              </span>
              <span className="text-2xl font-bold text-[#F26B3A]">
                {stats.totalPacts}
              </span>
            </Card>
            <Card className="text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
                Success Rate
              </span>
              <span className="text-2xl font-bold text-[#F26B3A]">
                {successRate}%
              </span>
            </Card>
            <Card className="text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
                Protocol Fees
              </span>
              <span className="text-2xl font-bold text-[#F26B3A]">
                {protocolFeesMOVE} MOVE
              </span>
            </Card>
          </div>
        </>
      )}

      {!isLoading && !error && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold uppercase tracking-tight">
              All Community Pacts
            </h3>
            <div className="flex gap-2">
              {/* View Filter */}
              <div className="flex gap-1 bg-[#15171C] p-1 border border-[#23262F]">
                <button
                  onClick={() => setViewFilter("ALL")}
                  className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                    viewFilter === "ALL"
                      ? "bg-[#F26B3A] text-[#0E0F12]"
                      : "text-[#8E9094] hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setViewFilter("WATCHLIST")}
                  className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                    viewFilter === "WATCHLIST"
                      ? "bg-[#F26B3A] text-[#0E0F12]"
                      : "text-[#8E9094] hover:text-white"
                  }`}
                >
                  Watchlist
                </button>
              </div>

              {/* Reputation Filter */}
              <div className="flex gap-1 bg-[#15171C] p-1 border border-[#23262F]">
                <button
                  onClick={() => setReputationFilter("ALL")}
                  className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                    reputationFilter === "ALL"
                      ? "bg-[#F26B3A] text-[#0E0F12]"
                      : "text-[#8E9094] hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setReputationFilter("HIGH")}
                  className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                    reputationFilter === "HIGH"
                      ? "bg-[#3FB950] text-[#0E0F12]"
                      : "text-[#8E9094] hover:text-white"
                  }`}
                >
                  High (70+)
                </button>
                <button
                  onClick={() => setReputationFilter("MEDIUM")}
                  className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                    reputationFilter === "MEDIUM"
                      ? "bg-[#4FD1C5] text-[#0E0F12]"
                      : "text-[#8E9094] hover:text-white"
                  }`}
                >
                  Med (40-69)
                </button>
                <button
                  onClick={() => setReputationFilter("LOW")}
                  className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                    reputationFilter === "LOW"
                      ? "bg-[#F26B3A] text-[#0E0F12]"
                      : "text-[#8E9094] hover:text-white"
                  }`}
                >
                  Low (&lt;40)
                </button>
              </div>
            </div>
          </div>

          {isConnected && pacts.length === 0 && (
            <div className="py-12 text-center border border-dashed border-[#23262F]">
              <p className="text-[#8E9094] mb-4">No pacts found.</p>
            </div>
          )}

          {isConnected && pacts.length > 0 && (
            <div className="border border-[#23262F]">
              <div className="hidden md:grid grid-cols-6 p-4 border-b border-[#23262F] text-[10px] uppercase font-bold tracking-widest text-[#8E9094]">
                <div className="col-span-1">Creator</div>
                <div className="col-span-3">Pact Intent</div>
                <div className="col-span-1">Stake</div>
                <div className="col-span-1">Outcome</div>
              </div>

              <div className="divide-y divide-[#23262F]">
                {pacts.map((pact, i) => (
                  <motion.div
                    key={pact.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="grid grid-cols-1 md:grid-cols-6 p-4 items-center gap-4 hover:bg-[#15171C] transition-colors"
                  >
                    <div className="col-span-1 flex items-center gap-2">
                      <Link
                        href={`/profile/${pact.creator}`}
                        className="flex items-center gap-2 hover:text-[#F26B3A] transition-colors"
                      >
                        <div className="w-6 h-6 bg-[#23262F] flex items-center justify-center text-[10px] font-bold">
                          {pact.creator.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-mono">
                            {pact.creator.slice(0, 6)}...
                            {pact.creator.slice(-4)}
                          </span>
                          {userReputations[pact.creator] !== undefined && (
                            <span className="text-[8px] text-[#8E9094]">
                              Rep: {userReputations[pact.creator].toFixed(0)}
                            </span>
                          )}
                        </div>
                      </Link>
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <span className="md:hidden text-[8px] uppercase font-bold text-[#8E9094] block mb-1">
                        Intent
                      </span>
                      <p className="font-caveat text-lg text-[#4FD1C5] truncate">
                        &quot;Hold ≥{" "}
                        {(pact.startBalance / 100_000_000).toFixed(2)} MOVE
                        until{" "}
                        {new Date(pact.deadline * 1000).toLocaleDateString()}
                        &quot;
                      </p>
                    </div>
                    <div className="col-span-1">
                      <span className="md:hidden text-[8px] uppercase font-bold text-[#8E9094] block mb-1">
                        Stake
                      </span>
                      <p className="text-sm font-bold">
                        {(pact.stakeAmount / 100_000_000).toFixed(2)} MOVE
                      </p>
                    </div>
                    <div className="col-span-1">
                      <span className="md:hidden text-[8px] uppercase font-bold text-[#8E9094] block mb-1">
                        Status
                      </span>
                      <PactStatusBadge status={pact.status} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
