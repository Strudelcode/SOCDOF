import React from 'react';

interface SocdofLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  showBorder?: boolean;
}

export const SocdofLogo: React.FC<SocdofLogoProps> = ({
  className = '',
  size = 'md',
  showBorder = false
}) => {
  const sizeConfig: Record<string, { container: string; rounded: string; text: string }> = {
    xs: { container: 'w-5 h-5', rounded: 'rounded-md', text: 'text-[10px]' },
    sm: { container: 'w-7 h-7', rounded: 'rounded-lg', text: 'text-xs' },
    md: { container: 'w-9 h-9', rounded: 'rounded-xl', text: 'text-sm' },
    lg: { container: 'w-12 h-12', rounded: 'rounded-xl', text: 'text-base' },
    xl: { container: 'w-16 h-16', rounded: 'rounded-2xl', text: 'text-xl' }
  };

  const currentConfig = typeof size === 'string'
    ? (sizeConfig[size] || sizeConfig.md)
    : {
        container: `w-[${size}px] h-[${size}px]`,
        rounded: size >= 48 ? 'rounded-2xl' : size >= 28 ? 'rounded-xl' : 'rounded-lg',
        text: 'text-xs'
      };

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${currentConfig.container} ${className}`}
      style={showBorder ? {
        padding: '1.5px',
        borderRadius: '24%',
        background: 'linear-gradient(135deg, #10B981, #EF4444, #F59E0B, #0078D7)'
      } : undefined}
    >
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-full h-full drop-shadow-xs select-none"
      >
        <defs>
          <linearGradient id="socdof-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#252932" />
            <stop offset="100%" stopColor="#14171d" />
          </linearGradient>
          <filter id="socdof-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Dark Squircle Background */}
        <rect 
          x="5" 
          y="5" 
          width="90" 
          height="90" 
          rx="22" 
          ry="22" 
          fill="url(#socdof-bg)" 
          filter="url(#socdof-shadow)" 
        />

        {/* 4 Corner Accent Strokes (Symmetrical & Non-clipped) */}
        {/* Top-Left: Emerald Green */}
        <path 
          d="M 5 32 C 5 17 17 5 32 5" 
          stroke="#22c55e" 
          strokeWidth="5.5" 
          strokeLinecap="round" 
          fill="none" 
        />
        {/* Top-Right: Sky Blue */}
        <path 
          d="M 68 5 C 83 5 95 17 95 32" 
          stroke="#38bdf8" 
          strokeWidth="5.5" 
          strokeLinecap="round" 
          fill="none" 
        />
        {/* Bottom-Right: Coral Red */}
        <path 
          d="M 95 68 C 95 83 83 95 68 95" 
          stroke="#ef4444" 
          strokeWidth="5.5" 
          strokeLinecap="round" 
          fill="none" 
        />
        {/* Bottom-Left: Amber Yellow */}
        <path 
          d="M 32 95 C 17 95 5 83 5 68" 
          stroke="#f59e0b" 
          strokeWidth="5.5" 
          strokeLinecap="round" 
          fill="none" 
        />

        {/* Subtle Specular Inner Rim */}
        <rect 
          x="8" 
          y="8" 
          width="84" 
          height="84" 
          rx="19" 
          ry="19" 
          stroke="rgba(255,255,255,0.08)" 
          strokeWidth="1.2" 
          fill="none" 
        />

        {/* Centered Modern Bold 'S' Lettermark */}
        <text 
          x="50" 
          y="66.5" 
          textAnchor="middle" 
          fontFamily="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          fontWeight="900" 
          fontSize="52" 
          fill="#ffffff" 
          letterSpacing="-1"
        >
          S
        </text>
      </svg>
    </div>
  );
};


