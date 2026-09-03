// client/src/components/admin/StatCard.js
import React from 'react';
import { StatTile } from '../ui';

// The old API took a Tailwind colour word. The design system has four accents,
// so callers keep their prop and it is mapped onto the nearest brand accent
// rather than every page inventing its own palette.
const ACCENT_BY_COLOR = {
  blue: 'azure',
  green: 'india',
  purple: 'ink',
  orange: 'saffron',
  red: 'saffron',
  yellow: 'saffron'
};

const StatCard = ({ title, value, subtitle, icon, trend, trendValue, color = 'blue' }) => (
  <StatTile
    label={title}
    // `?? 0` not `|| 0`: a real zero is a measurement, and must not be
    // swapped for a fallback that happens to look the same.
    value={value ?? 0}
    hint={trend && trendValue ? `${trend === 'up' ? '▲' : '▼'} ${trendValue}` : subtitle}
    icon={icon}
    accent={ACCENT_BY_COLOR[color] || 'ink'}
  />
);

export default StatCard;
