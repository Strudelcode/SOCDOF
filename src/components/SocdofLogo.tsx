import React from 'react';

interface SocdofLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  showBorder?: boolean;
}

export const SocdofLogo: React.FC<SocdofLogoProps> = ({
  className = '',
  size = 'md',
  showBorder = true
}) => {
  const sizeMap: Record<string, string> = {
    xs: 'w-5 h-5 text-xs',
    sm: 'w-7 h-7 text-sm',
    md: 'w-9 h-9 text-base',
    lg: 'w-12 h-12 text-xl',
    xl: 'w-16 h-16 text-2xl',
  };

  const dimensionClass = typeof size === 'number' ? `w-[${size}px] h-[${size}px]` : sizeMap[size] || sizeMap.md;

  return (
    <div 
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden shadow-xs shrink-0 select-none ${dimensionClass} ${className}`}
      style={{
        background: showBorder ? 'conic-gradient(from 0deg, #10B981 0% 90deg, #EF4444 90deg 180deg, #F59E0B 180deg 270deg, #0078D7 270deg 360deg)' : '#262626',
        padding: showBorder ? '2.5px' : '0'
      }}
    >
      <div className="w-full h-full bg-[#262626] rounded-[inherit] flex items-center justify-center">
        <span 
          className="font-black text-white leading-none text-center select-none"
          style={{ 
            fontFamily: "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
            fontSize: '115%',
            transform: 'translateY(-2%)'
          }}
        >
          S
        </span>
      </div>
    </div>
  );
};
