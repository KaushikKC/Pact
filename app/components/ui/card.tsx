
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#15171C] border border-[#23262F] p-6 transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-[#F26B3A] hover:shadow-[0_4px_20px_rgba(242,107,58,0.1)]' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
