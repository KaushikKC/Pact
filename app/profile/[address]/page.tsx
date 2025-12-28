"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/card";
import { PactStatusBadge } from "../../components/pact/pact-status-badge";
import { Button } from "../../components/ui/button";
import { fetchUserPacts, getUserStats } from "../../lib/pactTransactions";

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

interface UserStats {
  totalPacts: number;
  activePacts: number;
  passedPacts: number;
  failedPacts: number;
  successRate: number;
  totalStaked: number;
  totalVolume: number;
  reputationScore: number;
}

export default function UserProfilePage() {
  const params = useParams();
  const address = params?.address as string;
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PactStatus | "ALL">("ALL");

  useEffect(() => {
    const loadProfile = async () => {
      if (!address) {
        setError("Invalid address");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [userPacts, userStats] = await Promise.all([
          fetchUserPacts(address),
          getUserStats(address),
        ]);

        const transformedPacts: Pact[] = userPacts.map((pact) => {
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

        setPacts(transformedPacts);
        setStats(userStats);
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setError(err?.message || "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [address]);

  const filteredPacts =
    filter === "ALL" ? pacts : pacts.filter((p) => p.status === filter);

  const filters: (PactStatus | "ALL")[] = ["ALL", "ACTIVE", "PASSED", "FAILED"];

  const getReputationBadge = (score: number) => {
    if (score >= 80) return { label: "Trusted Alpha", color: "text-[#3FB950]" };
    if (score >= 60) return { label: "Reliable", color: "text-[#4FD1C5]" };
    if (score >= 40) return { label: "Building", color: "text-[#F26B3A]" };
    return { label: "New", color: "text-[#8E9094]" };
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <div className="py-20 text-center">
          <p className="text-[#8E9094]">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <div className="py-20 text-center border border-red-500/50 bg-red-500/10">
          <p className="text-red-400 mb-4">
            {error || "Failed to load profile"}
          </p>
          <Link href="/leaderboard">
            <Button variant="outline">Back to Leaderboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const reputationBadge = getReputationBadge(stats.reputationScore);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
      <Link
        href="/leaderboard"
        className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] hover:text-[#F26B3A] mb-8 inline-block"
      >
        ← Back to Leaderboard
      </Link>

      {/* Profile Header */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-tight mb-2">
              User Profile
            </h1>
            <p className="font-mono text-sm text-[#8E9094] break-all">
              {address}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${reputationBadge.color}`}>
              {stats.reputationScore}
            </div>
            <div className="text-xs uppercase tracking-widest text-[#8E9094]">
              Reputation
            </div>
            <div className={`text-sm font-bold mt-1 ${reputationBadge.color}`}>
              {reputationBadge.label}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-[#23262F] p-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
              Total Pacts
            </span>
            <span className="text-2xl font-bold text-[#F26B3A]">
              {stats.totalPacts}
            </span>
          </Card>
          <Card className="border-[#23262F] p-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
              Success Rate
            </span>
            <span className="text-2xl font-bold text-[#3FB950]">
              {stats.successRate}%
            </span>
          </Card>
          <Card className="border-[#23262F] p-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
              Total Staked
            </span>
            <span className="text-2xl font-bold text-[#4FD1C5]">
              {(stats.totalStaked / 100_000_000).toFixed(2)}
            </span>
            <span className="text-xs text-[#8E9094]">MOVE</span>
          </Card>
          <Card className="border-[#23262F] p-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
              Resolved
            </span>
            <span className="text-2xl font-bold">
              {stats.passedPacts + stats.failedPacts}
            </span>
            <span className="text-xs text-[#8E9094]">
              {stats.passedPacts} passed, {stats.failedPacts} failed
            </span>
          </Card>
        </div>

        {/* Status Breakdown */}
        <div className="flex gap-2 bg-[#15171C] p-1 border border-[#23262F] mb-8">
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
              {f}{" "}
              {f !== "ALL" &&
                `(${
                  f === "ACTIVE"
                    ? stats.activePacts
                    : f === "PASSED"
                    ? stats.passedPacts
                    : stats.failedPacts
                })`}
            </button>
          ))}
        </div>
      </div>

      {/* Pacts List */}
      {filteredPacts.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-[#23262F]">
          <p className="text-[#8E9094] mb-4">
            No pacts found matching this filter.
          </p>
        </div>
      ) : (
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
                        HOLD
                      </span>
                      <PactStatusBadge status={pact.status} />
                    </div>
                    <h3 className="text-2xl font-caveat text-[#4FD1C5] line-clamp-2">
                      &quot;Hold ≥{" "}
                      {(pact.startBalance / 100_000_000).toFixed(2)} MOVE until{" "}
                      {new Date(pact.deadline * 1000).toLocaleDateString()}
                      &quot;
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-t border-[#23262F] pt-4">
                      <div>
                        <p className="text-[10px] font-bold tracking-widest text-[#8E9094] uppercase mb-1">
                          Stake
                        </p>
                        <p className="font-bold text-lg">
                          {(pact.stakeAmount / 100_000_000).toFixed(2)} MOVE
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
    </div>
  );
}
