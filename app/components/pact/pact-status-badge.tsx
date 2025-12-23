
import React from 'react';
import { PactStatus } from '../../../app/types';

interface PactStatusBadgeProps {
  status: PactStatus;
}

export const PactStatusBadge: React.FC<PactStatusBadgeProps> = ({ status }) => {
  const styles = {
    ACTIVE: 'bg-[#D9A441]/10 text-[#D9A441] border-[#D9A441]/30',
    PENDING: 'bg-[#D9A441]/10 text-[#D9A441] border-[#D9A441]/30',
    PASSED: 'bg-[#3FB950]/10 text-[#3FB950] border-[#3FB950]/30',
    FAILED: 'bg-[#E5533D]/10 text-[#E5533D] border-[#E5533D]/30',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest border ${styles[status]}`}>
      {status}
    </span>
  );
};
