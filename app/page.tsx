'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from './components/ui/button';
import { INTENT_EXAMPLES } from './constants';
import TextType from './components/ui/TextType';

export default function LandingPage() {
  const [exampleIndex, setExampleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setExampleIndex((prev) => (prev + 1) % INTENT_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center text-center px-6 py-16 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(#23262F 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="z-10 max-w-4xl"
      >
        <TextType
          as="h1"
          text={["Commitments,", "enforced by code."]}
          typingSpeed={75}
          pauseDuration={1500}
          showCursor={true}
          cursorCharacter="|"
          className="text-5xl md:text-8xl font-bold uppercase tracking-tighter leading-none mb-6"
          textColors={["inherit", "#F26B3A"]}
        />
        <p className="text-xl md:text-2xl text-[#8E9094] max-w-2xl mx-auto mb-12 font-space">
          Intent-Based Finance for the high-integrity builder. 
          Stake assets on your promises. Verifiable by anyone. Settled by consensus.
        </p>

        <div className="h-24 mb-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={exampleIndex}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-5xl font-caveat text-[#4FD1C5]"
            >
              &quot;{INTENT_EXAMPLES[exampleIndex]}&quot;
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link href="/create">
            <Button size="lg" className="w-full sm:w-auto">Create Pact</Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">View Community Pacts</Button>
          </Link>
        </div>
      </motion.div>

      
    </div>
  );
}
