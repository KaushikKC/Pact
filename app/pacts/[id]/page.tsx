'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MOCK_PACTS } from '../../constants';
import { PactStatusBadge } from '../../components/pact/pact-status-badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

export default function PactDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const pact = MOCK_PACTS.find(p => p.id === id);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!pact) return;
    
    const calculateTime = () => {
      const deadline = new Date(pact.deadline).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;
      
      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${days}d ${hours}h ${mins}m ${secs}s`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [pact]);

  if (!pact) return <div className="p-20 text-center">Pact not found.</div>;

  const timelineSteps = [
    { label: 'Created', date: pact.createdAt, status: 'complete' },
    { label: 'Active', date: pact.createdAt, status: 'complete' },
    { label: 'Deadline', date: pact.deadline, status: pact.status !== 'ACTIVE' ? 'complete' : 'pending' },
    { label: 'Resolved', date: pact.resolvedAt || '...', status: pact.status !== 'ACTIVE' ? 'complete' : 'upcoming' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
      <Link href="/pacts" className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] hover:text-[#F26B3A] mb-8 inline-block">
        ← Back to My Pacts
      </Link>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section>
            <PactStatusBadge status={pact.status} />
            <h1 className="text-4xl md:text-6xl font-caveat text-[#4FD1C5] mt-6 leading-tight">
              &quot;{pact.statement}&quot;
            </h1>
          </section>

          <section className="space-y-6">
            <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094]">Pact Timeline</h3>
            <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#23262F]">
              {timelineSteps.map((step, i) => (
                <div key={i} className="relative">
                  <div className={`absolute -left-8 top-1 w-6 h-6 rounded-full border-4 border-[#0E0F12] flex items-center justify-center ${
                    step.status === 'complete' ? 'bg-[#3FB950]' : step.status === 'pending' ? 'bg-[#F26B3A]' : 'bg-[#23262F]'
                  }`} />
                  <div>
                    <p className="font-bold text-sm uppercase tracking-wider">{step.label}</p>
                    <p className="text-xs text-[#8E9094]">{step.date === '...' ? 'TBD' : new Date(step.date).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <Card className="border-[#23262F]">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-4">Total Stake</span>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold">{pact.stake}</span>
              <span className="text-xl font-bold text-[#F26B3A] uppercase">{pact.token}</span>
            </div>
            <p className="text-xs text-[#8E9094]">Staked on {new Date(pact.createdAt).toLocaleDateString()}</p>
          </Card>

          <Card className="border-[#23262F]">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-4">Time Remaining</span>
            <div className="text-2xl font-bold font-mono">
              {timeLeft}
            </div>
          </Card>

          {pact.status === 'ACTIVE' && (
            <Link href="/resolve">
              <Button className="w-full" size="lg">Resolve Pact</Button>
            </Link>
          )}

          <div className="pt-6">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] mb-3">Resolution Logic</h4>
            <p className="text-xs text-[#8E9094] leading-relaxed">
              This pact is governed by the {pact.type} controller. Verification occurs via movement-consensus proofs and decentralized oracles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

