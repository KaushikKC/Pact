'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MOCK_PACTS } from '../constants';
import { Card } from '../components/ui/card';
import { PactStatusBadge } from '../components/pact/pact-status-badge';

export default function LeaderboardPage() {
  // Sort by stake size for a "top stakers" feel
  const topPacts = [...MOCK_PACTS].sort((a, b) => b.stake - a.stake);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
      <div className="mb-12">
        <h2 className="text-4xl font-bold uppercase tracking-tight mb-2">Protocol Pulse</h2>
        <p className="text-[#8E9094]">Community commitments and global proof of integrity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {[
          { label: 'Total Volume', value: '$4.2M' },
          { label: 'Active Pacts', value: '1,284' },
          { label: 'Success Rate', value: '89.4%' },
          { label: 'Total Slashed', value: '2.1M MOVE' },
        ].map((stat, i) => (
          <Card key={i} className="text-center">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] block mb-2">{stat.label}</span>
            <span className="text-2xl font-bold text-[#F26B3A]">{stat.value}</span>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold uppercase tracking-tight mb-6">Recent Community Pacts</h3>
        <div className="border border-[#23262F]">
          <div className="hidden md:grid grid-cols-6 p-4 border-b border-[#23262F] text-[10px] uppercase font-bold tracking-widest text-[#8E9094]">
            <div className="col-span-1">Creator</div>
            <div className="col-span-3">Pact Intent</div>
            <div className="col-span-1">Stake</div>
            <div className="col-span-1">Outcome</div>
          </div>

          <div className="divide-y divide-[#23262F]">
            {topPacts.map((pact, i) => (
              <motion.div 
                key={pact.id} 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="grid grid-cols-1 md:grid-cols-6 p-4 items-center gap-4 hover:bg-[#15171C] transition-colors"
              >
                <div className="col-span-1 flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#23262F] flex items-center justify-center text-[10px] font-bold">U</div>
                  <span className="text-xs font-mono">{pact.creator}</span>
                </div>
                <div className="col-span-1 md:col-span-3">
                  <span className="md:hidden text-[8px] uppercase font-bold text-[#8E9094] block mb-1">Intent</span>
                  <p className="font-caveat text-lg text-[#4FD1C5] truncate">&quot;{pact.statement}&quot;</p>
                </div>
                <div className="col-span-1">
                  <span className="md:hidden text-[8px] uppercase font-bold text-[#8E9094] block mb-1">Stake</span>
                  <p className="text-sm font-bold">{pact.stake} {pact.token}</p>
                </div>
                <div className="col-span-1">
                  <span className="md:hidden text-[8px] uppercase font-bold text-[#8E9094] block mb-1">Status</span>
                  <PactStatusBadge status={pact.status} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

