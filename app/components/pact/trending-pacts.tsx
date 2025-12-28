"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "../ui/card";
import { PactStatusBadge } from "./pact-status-badge";
import { getTrendingPacts } from "../../lib/pactTransactions";

type PactStatus = "ACTIVE" | "PASSED" | "FAILED";

interface Pact {
  id: string;
  tokenAddress: string;
  startBalance: number;
  stakeAmount: number;
  deadline: number;
  status: PactStatus;
  creator: string;
  trendingScore?: number;
}

export function TrendingPacts() {
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTrending = async () => {
      setIsLoading(true);
      try {
        const trending = await getTrendingPacts(6);
        const transformedPacts: Pact[] = trending.map((pact) => {
          const statusMap: Record<number, PactStatus> = {
            0: "ACTIVE",
            1: "PASSED",
            2: "FAILED",
          };
          return {
            id: `${pact.creator}-${pact.index}`,
            tokenAddress: pact.tokenAddress,
            startBalance: pact.startBalance,
            stakeAmount: pact.stakeAmount,
            deadline: pact.deadline,
            status: statusMap[pact.status] || "ACTIVE",
            creator: pact.creator,
            trendingScore: pact.trendingScore,
          };
        });
        setPacts(transformedPacts);
      } catch (error) {
        console.error("Error loading trending pacts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrending();
  }, []);

  if (isLoading) {
    return (
      <div className="py-12">
        <p className="text-[#8E9094] text-center">Loading trending pacts...</p>
      </div>
    );
  }

  if (pacts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">
            🔥 Trending Pacts
          </h2>
          <p className="text-sm text-[#8E9094]">
            Most active commitments by stake and engagement
          </p>
        </div>
        <Link
          href="/leaderboard"
          className="text-[10px] uppercase font-bold tracking-widest text-[#F26B3A] hover:underline"
        >
          View All →
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pacts.map((pact, idx) => (
          <motion.div
            key={pact.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Link href={`/pacts/${pact.id}`}>
              <Card className="h-full flex flex-col justify-between group hover:border-[#F26B3A] transition-colors">
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#F26B3A]">
                        #{idx + 1}
                      </span>
                      <PactStatusBadge status={pact.status} />
                    </div>
                    <span className="text-xs font-bold text-[#4FD1C5]">
                      {(pact.stakeAmount / 100_000_000).toFixed(2)} MOVE
                    </span>
                  </div>
                  <h3 className="text-lg font-caveat text-[#4FD1C5] line-clamp-2 mb-2">
                    &quot;Hold ≥ {(pact.startBalance / 100_000_000).toFixed(2)}{" "}
                    MOVE until{" "}
                    {new Date(pact.deadline * 1000).toLocaleDateString()}&quot;
                  </h3>
                  <Link
                    href={`/profile/${pact.creator}`}
                    className="text-xs font-mono text-[#8E9094] hover:text-[#F26B3A] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {pact.creator.slice(0, 6)}...{pact.creator.slice(-4)}
                  </Link>
                </div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-[#F26B3A] opacity-0 group-hover:opacity-100 transition-opacity">
                  View Details →
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
