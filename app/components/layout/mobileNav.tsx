'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const MobileNav: React.FC = () => {
  const pathname = usePathname();

  const links = [
    { name: 'Home', path: '/', icon: '🏠' },
    { name: 'Pacts', path: '/pacts', icon: '📝' },
    { name: 'Create', path: '/create', icon: '➕' },
    { name: 'Resolve', path: '/resolve', icon: '⚡' },
    { name: 'Stats', path: '/leaderboard', icon: '🏆' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#15171C] border-t border-[#23262F] px-2 py-3 md:hidden">
      <div className="flex items-center justify-around">
        {links.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            className={`flex flex-col items-center gap-1 transition-colors ${
              pathname === link.path ? 'text-[#F26B3A]' : 'text-[#8E9094]'
            }`}
          >
            <span className="text-lg">{link.icon}</span>
            <span className="text-[10px] uppercase font-bold tracking-tight">{link.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};
