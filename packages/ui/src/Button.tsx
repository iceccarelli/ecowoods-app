import React from 'react';
export const Button = ({ children, onClick, variant = 'primary' }: any) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-2xl font-semibold transition-all active:scale-95 ${variant === 'primary' ? 'bg-[#0A3D2E] text-white' : 'bg-[#E8F5E9] text-[#0A3D2E]'}`}>
    {children}
  </button>
);
