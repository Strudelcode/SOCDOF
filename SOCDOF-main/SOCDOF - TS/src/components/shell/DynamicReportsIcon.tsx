import React from 'react';
import { Bug, Sparkles, MessageSquare, Lightbulb } from 'lucide-react';

interface DynamicReportsIconProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'bug' | 'idea' | 'feedback' | 'default';
}

export const DynamicReportsIcon: React.FC<DynamicReportsIconProps> = ({
  className = '',
  size = 'md',
  variant = 'default'
}) => {
  const sizeMap = {
    sm: {
      container: 'w-4 h-4 rounded-md',
      icon: 'w-3 h-3',
      subIcon: 'w-1.5 h-1.5',
      badge: false
    },
    md: {
      container: 'w-10 h-10 rounded-xl',
      icon: 'w-5 h-5',
      subIcon: 'w-2.5 h-2.5',
      badge: true
    },
    lg: {
      container: 'w-12 h-12 rounded-2xl',
      icon: 'w-6 h-6',
      subIcon: 'w-3 h-3',
      badge: true
    },
    xl: {
      container: 'w-16 h-16 rounded-3xl',
      icon: 'w-8 h-8',
      subIcon: 'w-4 h-4',
      badge: true
    }
  }[size];

  // Vibrant gradient matching modern App Store & OS standards
  const bgGradient = variant === 'idea'
    ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600'
    : variant === 'feedback'
    ? 'bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600'
    : 'bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500';

  return (
    <div 
      className={`relative select-none flex items-center justify-center text-white shadow-md transition-transform duration-200 ${bgGradient} ${sizeMap.container} ${className}`}
      title="Reports & Feedback"
    >
      {/* Primary Icon */}
      {variant === 'idea' ? (
        <Lightbulb className={`${sizeMap.icon} drop-shadow-xs`} />
      ) : variant === 'feedback' ? (
        <MessageSquare className={`${sizeMap.icon} drop-shadow-xs`} />
      ) : (
        <Bug className={`${sizeMap.icon} drop-shadow-xs`} />
      )}

      {/* Layered Micro-Badge for md, lg, xl sizes */}
      {sizeMap.badge && (
        <span className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-slate-900/80 border border-white/40 shadow-xs flex items-center justify-center">
          <Sparkles className={`${sizeMap.subIcon} text-amber-300`} />
        </span>
      )}
    </div>
  );
};
