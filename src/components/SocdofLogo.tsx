import React, { useState } from 'react';
import socdofIconPng from '../assets/socdof_icon.png';

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
  const [imgFailed, setImgFailed] = useState(false);

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

  if (!imgFailed) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${currentConfig.container} ${currentConfig.rounded} ${className}`}
        style={showBorder ? {
          padding: '1.5px',
          background: 'linear-gradient(135deg, #10B981, #EF4444, #F59E0B, #0078D7)'
        } : undefined}
      >
        <img
          src={socdofIconPng}
          alt="SOCDOF"
          onError={() => setImgFailed(true)}
          className={`w-full h-full object-contain ${currentConfig.rounded} select-none`}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div 
      className={`relative inline-flex items-center justify-center overflow-hidden shrink-0 select-none bg-slate-900 text-white font-black ${currentConfig.container} ${currentConfig.rounded} ${currentConfig.text} ${className}`}
      style={showBorder ? {
        padding: '1.5px',
        background: 'linear-gradient(135deg, #10B981, #EF4444, #F59E0B, #0078D7)'
      } : undefined}
    >
      <div className="w-full h-full bg-[#1e293b] rounded-[inherit] flex items-center justify-center">
        <span 
          className="font-black text-white leading-none select-none text-center"
          style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
          S
        </span>
      </div>
    </div>
  );
};

