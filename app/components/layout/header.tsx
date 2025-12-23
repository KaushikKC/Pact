'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '../ui/button';

export const Header: React.FC = () => {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Leaderboard', path: '/leaderboard' },
    { name: 'My Pacts', path: '/pacts' },
    { name: 'Resolve', path: '/resolve' },
    { name: 'Create Pact', path: '/create' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0E0F12]/80 backdrop-blur-md border-b border-[#23262F] px-4 py-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Image 
            src="/logo.png" 
            alt="Pact Logo" 
            width={32} 
            height={32}
            className="object-contain w-12 h-12 shrink-0"
            priority
            unoptimized
          />
          {/* <span className="text-xl font-bold tracking-tighter uppercase group-hover:text-[#F26B3A] transition-colors">Pact</span> */}
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`text-sm font-medium uppercase tracking-wider transition-colors hover:text-[#F26B3A] ${
                pathname === link.path ? 'text-[#F26B3A]' : 'text-[#8E9094]'
              }`}
            >
              {link.name}
            </Link>
          ))}
          <Link href="/">
            <Button size="sm">Connect Wallet</Button>
          </Link>
        </nav>

        <div className="flex md:hidden">
          <Link href="/">
            <Button size="sm">Connect Wallet</Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
