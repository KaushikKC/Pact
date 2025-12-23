'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_PACTS } from '../constants';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Pact } from '../types';

export default function ResolvePactPage() {
  const [selectedPact, setSelectedPact] = useState<Pact | null>(null);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<'SUCCESS' | 'FAILURE' | null>(null);

  const handleResolve = () => {
    setResolving(true);
    // Simulate resolution logic
    setTimeout(() => {
      setResolving(false);
      // Randomly fail or pass for demo
      setResult(Math.random() > 0.4 ? 'SUCCESS' : 'FAILURE');
    }, 2000);
  };

  const activePacts = MOCK_PACTS.filter(p => p.status === 'ACTIVE');

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 pb-32">
      <div className="mb-12">
        <h2 className="text-4xl font-bold uppercase tracking-tight mb-2">Resolve Pact</h2>
        <p className="text-[#8E9094]">Execute the code that enforces your commitment.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        <div className="space-y-4">
          <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] mb-4">Select an Active Pact</h3>
          <div className="space-y-3">
            {activePacts.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPact(p); setResult(null); }}
                className={`w-full text-left p-4 border transition-all ${
                  selectedPact?.id === p.id ? 'border-[#F26B3A] bg-[#F26B3A]/5' : 'border-[#23262F] hover:border-[#8E9094]'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8E9094]">{p.type}</span>
                  <span className="font-bold text-xs">{p.stake} {p.token}</span>
                </div>
                <p className="font-caveat text-xl text-[#4FD1C5]">&quot;{p.statement}&quot;</p>
              </button>
            ))}
            {activePacts.length === 0 && <p className="text-sm text-[#8E9094]">No active pacts to resolve.</p>}
          </div>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {!selectedPact ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center p-12 border border-dashed border-[#23262F] text-center"
              >
                <p className="text-[#8E9094] text-sm italic">Select a pact on the left to begin verification.</p>
              </motion.div>
            ) : result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <Card className={result === 'SUCCESS' ? 'border-[#3FB950]' : 'border-[#E5533D]'}>
                  <div className="text-center py-8">
                    <div className="mb-4">
                      {result === 'SUCCESS' ? (
                        <div className="w-16 h-16 bg-[#3FB950] rounded-full mx-auto flex items-center justify-center text-3xl">✓</div>
                      ) : (
                        <div className="w-16 h-16 bg-[#E5533D] rounded-full mx-auto flex items-center justify-center text-3xl">✕</div>
                      )}
                    </div>
                    <h4 className={`text-3xl font-bold uppercase tracking-tighter mb-2 ${result === 'SUCCESS' ? 'text-[#3FB950]' : 'text-[#E5533D]'}`}>
                      Pact {result === 'SUCCESS' ? 'Verified' : 'Failed'}
                    </h4>
                    <p className="text-[#8E9094] text-sm">
                      {result === 'SUCCESS' 
                        ? 'Congratulations. Your intent was fulfilled and stake has been returned.'
                        : 'Protocol integrity check failed. Your stake has been slashed.'}
                    </p>
                  </div>
                </Card>
                <Button variant="outline" className="w-full" onClick={() => setSelectedPact(null)}>Back to Selection</Button>
              </motion.div>
            ) : (
              <motion.div 
                key="details"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <Card className="border-[#23262F]">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] mb-4">Resolution Rule</h4>
                  <div className="space-y-4 text-sm text-[#8E9094]">
                    <div className="flex justify-between py-2 border-b border-[#23262F]">
                      <span>Check Logic:</span>
                      <code className="text-[#4FD1C5]">consensus.checkHold(&apos;{selectedPact.token}&apos;)</code>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#23262F]">
                      <span>Staked Assets:</span>
                      <span className="text-white">{selectedPact.stake} {selectedPact.token}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span>Oracle Status:</span>
                      <span className="text-[#3FB950]">Operational</span>
                    </div>
                  </div>
                </Card>

                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleResolve}
                  isLoading={resolving}
                >
                  {resolving ? 'Verifying Proofs...' : 'Execute Resolution'}
                </Button>
                
                <p className="text-center text-[10px] uppercase tracking-widest text-[#8E9094]">
                  Resolution is irreversible once executed on-chain.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

