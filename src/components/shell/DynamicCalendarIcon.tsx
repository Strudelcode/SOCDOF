import React, { useState, useEffect } from 'react';

interface DynamicCalendarIconProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDayOfWeek?: boolean;
}

export const DynamicCalendarIcon: React.FC<DynamicCalendarIconProps> = ({
  className = '',
  size = 'md',
  showDayOfWeek = true
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000 * 60); // Check every minute
    return () => clearInterval(timer);
  }, []);

  const dayNumber = currentDate.getDate();
  const dayNameShort = currentDate.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase().slice(0, 3);

  // Size styling maps
  const sizeClasses = {
    sm: 'w-6 h-6 rounded-lg text-[9px]',
    md: 'w-10 h-10 rounded-xl text-xs',
    lg: 'w-12 h-12 rounded-2xl text-sm',
    xl: 'w-16 h-16 rounded-3xl text-base'
  }[size];

  const headerHeight = {
    sm: 'h-2 text-[6px]',
    md: 'h-3 text-[8px]',
    lg: 'h-3.5 text-[9px]',
    xl: 'h-4.5 text-[11px]'
  }[size];

  const numberFontSize = {
    sm: 'text-[10px] -mt-0.5',
    md: 'text-base font-black -mt-0.5',
    lg: 'text-xl font-black -mt-1',
    xl: 'text-2xl font-black -mt-1'
  }[size];

  return (
    <div 
      className={`relative select-none overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col items-center justify-between transition-transform duration-200 group-hover:scale-105 ${sizeClasses} ${className}`}
    >
      {/* Top Header Bar (Google Calendar Blue / Accent) */}
      <div className={`w-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-extrabold uppercase tracking-wider ${headerHeight}`}>
        {showDayOfWeek ? dayNameShort : ''}
      </div>

      {/* Center Dynamic Day Number */}
      <div className="flex-1 w-full flex items-center justify-center">
        <span className={`text-slate-900 dark:text-white leading-none tracking-tighter ${numberFontSize}`}>
          {dayNumber}
        </span>
      </div>

      {/* Bottom Subtle Accent Indicator */}
      <div className="w-2 h-0.5 rounded-full bg-blue-500/40 mb-0.5" />
    </div>
  );
};
