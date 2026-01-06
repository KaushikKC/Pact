"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "../../components/ui/button";
import { PactStatusBadge } from "../../components/pact/pact-status-badge";
import { Card } from "../../components/ui/card";
import { SharePactButton } from "../../components/pact/share-pact-button";
import {
  fetchPact,
  submitChallengePactTransaction,
  submitJoinGroupPactTransaction,
  getCurrentBalance,
  CONTRACT_ADDRESS,
} from "../../lib/pactTransactions";
import { MOVEMENT_CONFIGS, CURRENT_NETWORK } from "../../lib/aptos";
import { useWallet } from "../../contexts/WalletContext";

type PactStatus = "ACTIVE" | "PASSED" | "FAILED";

interface Pact {
  tokenAddress: string;
  startBalance: number;
  stakeAmount: number;
  deadline: number;
  status: PactStatus;
  creator: string;
  index: number;
  isGroup?: boolean;
  maxGroupSize?: number;
  challenge?: { challenger: string; challengeStake: number } | null;
  groupMembers?: string[];
}

interface TimelineEvent {
  type: "created" | "challenged" | "member_joined" | "deadline" | "resolved";
  label: string;
  date: string;
  status: "complete" | "pending" | "upcoming";
  details?: string;
}

export default function PactDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { address, isConnected, signAndSubmitTransaction } = useWallet();
  const [pact, setPact] = useState<Pact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeAmount, setChallengeAmount] = useState("");
  const [isChallenging, setIsChallenging] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinStake, setJoinStake] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Parse ID to get creator address and index
  useEffect(() => {
    const loadPact = async () => {
      if (!id) {
        setError("Invalid pact ID");
        setIsLoading(false);
        return;
      }

      try {
        // ID format: "creatorAddress-index"
        const parts = id.split("-");
        if (parts.length < 2) {
          setError("Invalid pact ID format");
          setIsLoading(false);
          return;
        }

        const index = parseInt(parts[parts.length - 1], 10);
        const creatorAddress = parts.slice(0, -1).join("-");

        if (isNaN(index)) {
          setError("Invalid pact index");
          setIsLoading(false);
          return;
        }

        const fetchedPact = await fetchPact(creatorAddress, index);

        if (!fetchedPact) {
          setError("Pact not found");
          setIsLoading(false);
          return;
        }

        const statusMap: Record<number, PactStatus> = {
          0: "ACTIVE",
          1: "PASSED",
          2: "FAILED",
        };

        const pactData: Pact = {
          tokenAddress: fetchedPact.tokenAddress,
          startBalance: fetchedPact.startBalance,
          stakeAmount: fetchedPact.stakeAmount,
          deadline: fetchedPact.deadline,
          status: statusMap[fetchedPact.status] || "ACTIVE",
          creator: fetchedPact.creator,
          index: fetchedPact.index,
          isGroup: fetchedPact.isGroup || false,
          maxGroupSize: fetchedPact.maxGroupSize || 0,
          challenge: fetchedPact.challenge || null,
          groupMembers: fetchedPact.groupMembers || [],
        };

        setPact(pactData);

        // Build timeline from events
        await buildTimeline(creatorAddress, index, pactData);
      } catch (err: any) {
        console.error("Error loading pact:", err);
        setError(err?.message || "Failed to load pact");
      } finally {
        setIsLoading(false);
      }
    };

    loadPact();
  }, [id]);

  // Build timeline from events
  const buildTimeline = async (
    creatorAddress: string,
    pactIndex: number,
    pactData: Pact
  ) => {
    const events: TimelineEvent[] = [];
    const fullnodeUrl = MOVEMENT_CONFIGS[CURRENT_NETWORK].fullnode;

    try {
      // Fetch creation event
      const createdEvents = await fetch(
        `${fullnodeUrl}/accounts/${CONTRACT_ADDRESS}/events/${encodeURIComponent(
          `${CONTRACT_ADDRESS}::pact::PactRegistry`
        )}/${encodeURIComponent("pact_created_events")}?limit=1000`
      ).then((r) => r.json());

      const creationEvent = createdEvents.find(
        (e: any) =>
          e.data?.creator === creatorAddress && e.data?.pact_id === pactIndex
      );

      if (creationEvent) {
        events.push({
          type: "created",
          label: "Pact Created",
          date: new Date(Number(creationEvent.data?.deadline) * 1000 - 86400000).toLocaleString(), // Approximate
          status: "complete",
          details: `Stake locked: ${(pactData.stakeAmount / 100_000_000).toFixed(2)} MOVE`,
        });
      }

      // Fetch challenge event
      if (pactData.challenge) {
        const challengeEvents = await fetch(
          `${fullnodeUrl}/accounts/${CONTRACT_ADDRESS}/events/${encodeURIComponent(
            `${CONTRACT_ADDRESS}::pact::PactRegistry`
          )}/${encodeURIComponent("pact_challenged_events")}?limit=1000`
        ).then((r) => r.json());

        const challengeEvent = challengeEvents.find(
          (e: any) =>
            e.data?.creator === creatorAddress &&
            e.data?.pact_id === pactIndex
        );

        if (challengeEvent) {
          events.push({
            type: "challenged",
            label: "Challenged",
            date: new Date(Number(challengeEvent.version) * 1000).toLocaleString(),
            status: "complete",
            details: `Challenged by ${pactData.challenge.challenger.slice(0, 6)}...${pactData.challenge.challenger.slice(-4)} with ${(pactData.challenge.challengeStake / 100_000_000).toFixed(2)} MOVE`,
          });
        }
      }

      // Add group member join events
      if (pactData.isGroup && pactData.groupMembers) {
        const joinEvents = await fetch(
          `${fullnodeUrl}/accounts/${CONTRACT_ADDRESS}/events/${encodeURIComponent(
            `${CONTRACT_ADDRESS}::pact::PactRegistry`
          )}/${encodeURIComponent("group_member_joined_events")}?limit=1000`
        ).then((r) => r.json());

        const relevantJoinEvents = joinEvents.filter(
          (e: any) =>
            e.data?.creator === creatorAddress && e.data?.pact_id === pactIndex
        );

        relevantJoinEvents.forEach((e: any) => {
          events.push({
            type: "member_joined",
            label: "Member Joined",
            date: new Date(Number(e.version) * 1000).toLocaleString(),
            status: "complete",
            details: `${e.data?.member.slice(0, 6)}...${e.data?.member.slice(-4)} joined`,
          });
        });
      }

      // Add deadline
      events.push({
        type: "deadline",
        label: "Deadline Reached",
        date: new Date(pactData.deadline * 1000).toLocaleString(),
        status:
          Date.now() >= pactData.deadline * 1000 ? "complete" : "pending",
      });

      // Add resolution if resolved
      if (pactData.status !== "ACTIVE") {
        events.push({
          type: "resolved",
          label: "Resolved",
          date: "Resolved",
          status: "complete",
          details: pactData.status === "PASSED" ? "✅ PASSED" : "❌ FAILED",
        });
      }

      // Sort by date
      events.sort((a, b) => {
        if (a.date === "Resolved" || b.date === "Resolved") return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      setTimelineEvents(events);
    } catch (err) {
      console.error("Error building timeline:", err);
      // Fallback timeline
      setTimelineEvents([
        {
          type: "created",
          label: "Pact Created",
          date: "TBD",
          status: "complete",
        },
        {
          type: "deadline",
          label: "Deadline",
          date: new Date(pactData.deadline * 1000).toLocaleString(),
          status: Date.now() >= pactData.deadline * 1000 ? "complete" : "pending",
        },
        {
          type: "resolved",
          label: "Resolved",
          date: pactData.status !== "ACTIVE" ? "Resolved" : "TBD",
          status: pactData.status !== "ACTIVE" ? "complete" : "upcoming",
        },
      ]);
    }
  };

  const handleChallenge = async () => {
    if (!isConnected || !address || !signAndSubmitTransaction || !pact) {
      setError("Please connect your wallet");
      return;
    }

    if (!challengeAmount || Number(challengeAmount) < 0.01) {
      setError("Minimum challenge stake is 0.01 MOVE");
      return;
    }

    setIsChallenging(true);
    setError(null);

    try {
      const challengeStakeOctas = Math.floor(
        Number(challengeAmount) * 100_000_000
      );

      await submitChallengePactTransaction(
        pact.creator,
        pact.index,
        challengeStakeOctas,
        address,
        signAndSubmitTransaction
      );

      setShowChallengeModal(false);
      setChallengeAmount("");
      // Reload pact to show challenge
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to challenge pact");
    } finally {
      setIsChallenging(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!isConnected || !address || !signAndSubmitTransaction || !pact) {
      setError("Please connect your wallet");
      return;
    }

    if (!joinStake || Number(joinStake) < 0.01) {
      setError("Minimum stake is 0.01 MOVE");
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const currentBalance = await getCurrentBalance(address);
      const stakeOctas = Math.floor(Number(joinStake) * 100_000_000);
      const balanceOctas = Math.floor(currentBalance);

      await submitJoinGroupPactTransaction(
        pact.creator,
        pact.index,
        stakeOctas,
        balanceOctas,
        address,
        signAndSubmitTransaction
      );

      setShowJoinModal(false);
      setJoinStake("");
      // Reload pact to show new member
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to join group pact");
    } finally {
      setIsJoining(false);
    }
  };

  // Calculate time remaining
  useEffect(() => {
    if (!pact) return;

    const calculateTime = () => {
      const deadline = pact.deadline * 1000; // Convert to milliseconds
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${mins}m ${secs}s`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [pact]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
        <div className="p-20 text-center">
          <p className="text-[#8E9094]">Loading pact details...</p>
        </div>
      </div>
    );
  }

  if (error || !pact) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
        <div className="p-20 text-center">
          <p className="text-red-400 mb-4">{error || "Pact not found"}</p>
          <Link href="/pacts">
            <Button variant="outline">Back to My Pacts</Button>
          </Link>
        </div>
      </div>
    );
  }

  const deadlineDate = new Date(pact.deadline * 1000);
  const isDeadlinePassed = Date.now() >= deadlineDate.getTime();
  const canResolve = pact.status === "ACTIVE" && isDeadlinePassed;
  const canChallenge =
    pact.status === "ACTIVE" &&
    !isDeadlinePassed &&
    !pact.challenge &&
    address !== pact.creator;
  const canJoinGroup =
    pact.isGroup &&
    pact.status === "ACTIVE" &&
    !isDeadlinePassed &&
    address !== pact.creator &&
    (pact.groupMembers?.length || 0) < (pact.maxGroupSize || 0) &&
    !pact.groupMembers?.includes(address || "");

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
      <Link
        href="/pacts"
        className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] hover:text-[#F26B3A] mb-8 inline-block"
      >
        ← Back to My Pacts
      </Link>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section>
            <PactStatusBadge status={pact.status} />
            <h1 className="text-4xl md:text-6xl font-caveat text-[#4FD1C5] mt-6 leading-tight">
              &quot;Hold ≥ {(pact.startBalance / 100_000_000).toFixed(2)} MOVE
              until {deadlineDate.toLocaleDateString()}&quot;
            </h1>
            <div className="flex items-center gap-4 mt-4">
              <p className="text-sm text-[#8E9094]">
                Token: {pact.tokenAddress.slice(0, 6)}...
                {pact.tokenAddress.slice(-4)}
              </p>
              <Link
                href={`/profile/${pact.creator}`}
                className="text-sm text-[#F26B3A] hover:underline"
              >
                View Creator Profile →
              </Link>
            </div>
          </section>

          {pact.isGroup && (
            <section className="space-y-4">
              <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094]">
                Group Members ({pact.groupMembers?.length || 0}/{pact.maxGroupSize || 0})
              </h3>
              <div className="flex flex-wrap gap-2">
                {pact.groupMembers
                  ?.filter((member) => member && member.startsWith("0x") && !member.includes(",") && !member.includes("%2C"))
                  .map((member, i) => {
                    // Ensure member is a single address (not concatenated)
                    const cleanMember = member.trim();
                    // Validate it's a proper address format
                    if (!cleanMember.startsWith("0x") || cleanMember.length < 10) {
                      return null;
                    }
                    return (
                      <Link
                        key={`${cleanMember}-${i}`}
                        href={`/profile/${cleanMember}`}
                        className="px-3 py-1 bg-[#15171C] border border-[#23262F] rounded text-sm hover:border-[#F26B3A] transition-colors"
                      >
                        {cleanMember.slice(0, 6)}...{cleanMember.slice(-4)}
                      </Link>
                    );
                  })
                  .filter((item) => item !== null)}
              </div>
            </section>
          )}

          {pact.challenge && (
            <section className="space-y-4">
              <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094]">
                Challenge
              </h3>
              <Card className="border-[#F26B3A]">
                <p className="text-sm mb-2">
                  Challenged by{" "}
                  <Link
                    href={`/profile/${pact.challenge.challenger}`}
                    className="text-[#F26B3A] hover:underline"
                  >
                    {pact.challenge.challenger.slice(0, 6)}...
                    {pact.challenge.challenger.slice(-4)}
                  </Link>
                </p>
                <p className="text-xs text-[#8E9094]">
                  Challenge stake:{" "}
                  {(pact.challenge.challengeStake / 100_000_000).toFixed(2)} MOVE
                </p>
                <p className="text-xs text-[#8E9094] mt-2">
                  If creator succeeds → wins challenger stake. If fails →
                  challenger wins + creator slashed.
                </p>
              </Card>
            </section>
          )}

          <section className="space-y-6">
            <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094]">
              Pact Timeline
            </h3>
            <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#23262F]">
              {timelineEvents.length > 0
                ? timelineEvents.map((event, i) => (
                    <div key={i} className="relative">
                      <div
                        className={`absolute -left-8 top-1 w-6 h-6 rounded-full border-4 border-[#0E0F12] flex items-center justify-center ${
                          event.status === "complete"
                            ? "bg-[#3FB950]"
                            : event.status === "pending"
                            ? "bg-[#F26B3A]"
                            : "bg-[#23262F]"
                        }`}
                      />
                      <div>
                        <p className="font-bold text-sm uppercase tracking-wider">
                          {event.label}
                        </p>
                        <p className="text-xs text-[#8E9094]">
                          {event.date === "TBD" || event.date === "Resolved"
                            ? event.date
                            : event.date}
                        </p>
                        {event.details && (
                          <p className="text-xs text-[#8E9094] mt-1">
                            {event.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                : null}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <Card className="border-[#23262F]">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-4">
              Total Stake
            </span>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold">
                {(pact.stakeAmount / 100_000_000).toFixed(2)}
              </span>
              <span className="text-xl font-bold text-[#F26B3A] uppercase">
                MOVE
              </span>
            </div>
            <p className="text-xs text-[#8E9094]">Stake Amount</p>
          </Card>

          <Card className="border-[#23262F]">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-4">
              Time Remaining
            </span>
            <div className="text-2xl font-bold font-mono">{timeLeft}</div>
          </Card>

          {canJoinGroup && (
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => setShowJoinModal(true)}
            >
              Join Group Pact
            </Button>
          )}

          {canChallenge && (
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => setShowChallengeModal(true)}
            >
              Challenge Pact
            </Button>
          )}

          {canResolve && (
            <Link href={`/resolve?pact=${id}`}>
              <Button className="w-full" size="lg">
                Resolve Pact
              </Button>
            </Link>
          )}

          {pact.challenge && (
            <Card className="border-[#F26B3A] p-4">
              <p className="text-xs text-[#8E9094] mb-2">Challenge Active</p>
              <p className="text-sm font-bold">
                {(pact.challenge.challengeStake / 100_000_000).toFixed(2)} MOVE
                at stake
              </p>
            </Card>
          )}

          <div className="space-y-2 mt-4">
            <Link href={`/profile/${pact.creator}`}>
              <Button variant="outline" className="w-full">
                View Creator Profile
              </Button>
            </Link>
            <SharePactButton
              pactId={id}
              pactStatement={`Hold ≥ ${(
                pact.startBalance / 100_000_000
              ).toFixed(2)} MOVE until ${new Date(
                pact.deadline * 1000
              ).toLocaleDateString()}`}
              creatorAddress={pact.creator}
              stakeAmount={pact.stakeAmount}
            />
          </div>

          {pact.status === "ACTIVE" && !isDeadlinePassed && (
            <div className="text-xs text-[#8E9094] text-center">
              Pact can be resolved after deadline
            </div>
          )}

          <div className="pt-6">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] mb-3">
              Resolution Logic
            </h4>
            <p className="text-xs text-[#8E9094] leading-relaxed">
              <strong>Resolution Logic:</strong> At the deadline, the contract
              checks if your balance of token {pact.tokenAddress.slice(0, 6)}...
              {pact.tokenAddress.slice(-4)} is greater than or equal to{" "}
              {(pact.startBalance / 100_000_000).toFixed(2)} MOVE (the minimum
              you committed to hold).
              <br />
              <br />✅ <strong>PASS:</strong> Balance ≥{" "}
              {(pact.startBalance / 100_000_000).toFixed(2)} MOVE → Full stake
              returned
              <br />❌ <strong>FAIL:</strong> Balance &lt;{" "}
              {(pact.startBalance / 100_000_000).toFixed(2)} MOVE → Stake
              slashed (90% returned, 10% protocol fee)
            </p>
          </div>
        </div>
      </div>

      {/* Challenge Modal */}
      {showChallengeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 border-[#F26B3A]">
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold">Challenge Pact</h3>
              <p className="text-sm text-[#8E9094]">
                Stake against this pact. If the creator fails, you win their
                stake. If they succeed, they win your stake.
              </p>
              <div>
                <label className="text-sm uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
                  Challenge Stake (MOVE)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="w-full bg-[#15171C] border border-[#23262F] p-3 text-white focus:outline-none focus:border-[#F26B3A]"
                  placeholder="0.01"
                  value={challengeAmount}
                  onChange={(e) => setChallengeAmount(e.target.value)}
                />
                <p className="text-xs text-[#8E9094] mt-1">
                  Minimum: 0.01 MOVE
                </p>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 text-sm rounded">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowChallengeModal(false);
                    setChallengeAmount("");
                    setError(null);
                  }}
                  disabled={isChallenging}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleChallenge}
                  disabled={isChallenging || !challengeAmount}
                >
                  {isChallenging ? "Challenging..." : "Challenge"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 border-[#4FD1C5]">
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold">Join Group Pact</h3>
              <p className="text-sm text-[#8E9094]">
                Join this group pact. All members must hold their balance. If
                one breaks, their stake is redistributed or burned.
              </p>
              <div>
                <label className="text-sm uppercase font-bold tracking-widest text-[#8E9094] block mb-2">
                  Your Stake (MOVE)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="w-full bg-[#15171C] border border-[#23262F] p-3 text-white focus:outline-none focus:border-[#4FD1C5]"
                  placeholder="0.01"
                  value={joinStake}
                  onChange={(e) => setJoinStake(e.target.value)}
                />
                <p className="text-xs text-[#8E9094] mt-1">
                  Minimum: 0.01 MOVE
                </p>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 text-sm rounded">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinStake("");
                    setError(null);
                  }}
                  disabled={isJoining}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleJoinGroup}
                  disabled={isJoining || !joinStake}
                >
                  {isJoining ? "Joining..." : "Join"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
