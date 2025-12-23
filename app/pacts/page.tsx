'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card } from '../components/ui/card';
import { PactStatusBadge } from '../components/pact/pact-status-badge';
import { MOCK_PACTS } from '../constants';
import { PactStatus } from '../types';

export default function MyPactsPage() {
  const [filter, setFilter] = useState<PactStatus | 'ALL'>('ALL');

  const filteredPacts = filter === 'ALL' 
    ? MOCK_PACTS 
    : MOCK_PACTS.filter(p => p.status === filter);

  const filters: (PactStatus | 'ALL')[] = ['ALL', 'ACTIVE', 'PASSED', 'FAILED'];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-bold uppercase tracking-tight mb-2">My Pacts</h2>
          <p className="text-[#8E9094]">Manage your commitments and check status.</p>
        </div>
        
        <div className="flex gap-2 bg-[#15171C] p-1 border border-[#23262F]">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest transition-colors ${
                filter === f ? 'bg-[#F26B3A] text-[#0E0F12]' : 'text-[#8E9094] hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

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
                    <span className="text-[10px] font-bold tracking-widest text-[#8E9094] uppercase">{pact.type}</span>
                    <PactStatusBadge status={pact.status} />
                  </div>
                  <h3 className="text-2xl font-caveat text-[#4FD1C5] line-clamp-2">&quot;{pact.statement}&quot;</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-t border-[#23262F] pt-4">
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-[#8E9094] uppercase mb-1">Stake</p>
                      <p className="font-bold text-lg">{pact.stake} {pact.token}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold tracking-widest text-[#8E9094] uppercase mb-1">Ends</p>
                      <p className="font-medium text-sm text-white/70">{new Date(pact.deadline).toLocaleDateString()}</p>
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

      {filteredPacts.length === 0 && (
        <div className="py-20 text-center border border-dashed border-[#23262F]">
          <p className="text-[#8E9094] mb-4">No pacts found matching this filter.</p>
          <Link href="/create">
            <button className="text-[#F26B3A] font-bold uppercase text-xs tracking-widest">Create One Now</button>
          </Link>
        </div>
      )}
    </div>
  );
}

