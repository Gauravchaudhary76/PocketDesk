import React from 'react';

interface StageBadgeProps {
  stage: number;
  label?: string;
  variant?: 'subtle' | 'outline' | 'filled';
}

export const StageBadge: React.FC<StageBadgeProps> = ({
  stage,
  label,
  variant = 'subtle'
}) => {
  const text = label || `Stage ${stage} Feature`;

  if (variant === 'filled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        {text}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700/80">
      <span className="text-slate-500">⏳</span>
      {text}
    </span>
  );
};
