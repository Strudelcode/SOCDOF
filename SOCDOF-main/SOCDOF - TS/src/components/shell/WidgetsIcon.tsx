import React from 'react';

export const WidgetsIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {/* Top-Left Rounded Square */}
    <rect width="7" height="7" x="3" y="3" rx="1.5" />
    {/* Top-Right Rounded Square */}
    <rect width="7" height="7" x="14" y="3" rx="1.5" />
    {/* Bottom-Left Rounded Square */}
    <rect width="7" height="7" x="3" y="14" rx="1.5" />
    {/* Bottom-Right Circle for recognizable modular widget differentiation */}
    <circle cx="17.5" cy="17.5" r="3.5" />
  </svg>
);
