import React, { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gray';
}

const colorStyles: Record<string, { bg: string; icon: string; text: string; border: string }> = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-azure-500',
    text: 'text-azure-700',
    border: 'border-blue-100',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-500',
    text: 'text-green-700',
    border: 'border-green-100',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'text-amber-500',
    text: 'text-amber-700',
    border: 'border-amber-100',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-500',
    text: 'text-red-700',
    border: 'border-red-100',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-500',
    text: 'text-purple-700',
    border: 'border-purple-100',
  },
  gray: {
    bg: 'bg-gray-50',
    icon: 'text-gray-500',
    text: 'text-gray-700',
    border: 'border-gray-100',
  },
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const trendColors = {
  up: 'text-green-600',
  down: 'text-red-600',
  neutral: 'text-gray-400',
};

export const KpiCard: React.FC<KpiCardProps> = ({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  color = 'blue',
}) => {
  const styles = colorStyles[color] ?? colorStyles.blue;
  const [animate, setAnimate] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setAnimate(true);
      prevValueRef.current = value;
      const timer = setTimeout(() => setAnimate(false), 300);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const TrendIcon = trend ? trendIcons[trend] : null;

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${styles.border} p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 mb-1 truncate">{title}</p>
          <p className={`text-2xl font-bold ${styles.text} ${animate ? 'value-changed' : ''}`}>
            {value}
          </p>
          {subtitle && (
            <div className="flex items-center gap-1 mt-1">
              {TrendIcon && <TrendIcon size={12} className={trendColors[trend!]} />}
              <p className={`text-xs ${trend ? trendColors[trend] : 'text-gray-400'}`}>
                {subtitle}
              </p>
            </div>
          )}
        </div>
        <div className={`${styles.bg} p-3 rounded-lg flex-shrink-0`}>
          <Icon size={22} className={styles.icon} />
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
