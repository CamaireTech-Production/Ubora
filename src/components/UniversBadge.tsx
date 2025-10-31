import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ExternalLink } from 'lucide-react';

interface UniversBadgeProps {
  universId: string;
  universName?: string;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export const UniversBadge: React.FC<UniversBadgeProps> = ({
  universId,
  universName,
  className = '',
  showIcon = true,
  size = 'sm'
}) => {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  
  return (
    <Link
      to={`/univers/${universId}`}
      className={`
        inline-flex items-center space-x-1.5
        bg-gradient-to-r from-blue-50 to-indigo-50
        border border-blue-200
        text-blue-700
        rounded-full
        font-medium
        hover:from-blue-100 hover:to-indigo-100
        hover:border-blue-300
        transition-all duration-200
        ${sizeClasses}
        ${className}
      `}
      title={universName ? `Univers: ${universName}` : 'Voir le Univers'}
      onClick={(e) => e.stopPropagation()}
    >
      {showIcon && (
        <Sparkles className="h-3 w-3 flex-shrink-0" />
      )}
      <span className="truncate max-w-[120px] sm:max-w-[150px]">
        {universName || 'Univers'}
      </span>
      <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />
    </Link>
  );
};

