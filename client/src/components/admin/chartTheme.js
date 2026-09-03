// client/src/components/admin/chartTheme.js
//
// Brand palette and shared scaffolding for the Recharts wrappers.
//
// Recharts renders a bare <svg>. To a screen reader that is silence, so every
// chart in this folder pairs its picture with `ChartFallbackTable` — the same
// numbers as a real, if visually hidden, table. The chart is then marked
// aria-hidden, because a duplicated axis label read out of order is worse than
// no chart at all.
import React from 'react';

/** Hex values pulled from tailwind.config.js — Recharts cannot take classes. */
export const BRAND = {
  ink: '#0B0C0E',
  inkMuted: '#4A505B',
  saffron: '#FF9933',
  india: '#138808',
  azure: '#1E7AAD',
  grid: 'rgba(11, 12, 14, 0.10)'
};

/** Series colours in the order a multi-series chart should consume them. */
export const BRAND_SERIES = [
  BRAND.ink,
  BRAND.saffron,
  BRAND.india,
  BRAND.azure,
  '#B85F11',
  '#0F6C06',
  '#0F4C74',
  BRAND.inkMuted
];

/** Axis/grid props shared by the cartesian charts, so they stay identical. */
export const AXIS_PROPS = {
  tick: { fill: BRAND.inkMuted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: BRAND.grid }
};

export const TOOLTIP_PROPS = {
  cursor: { fill: 'rgba(11, 12, 14, 0.04)' },
  contentStyle: {
    borderRadius: 12,
    border: '1px solid rgba(11, 12, 14, 0.15)',
    boxShadow: 'none',
    fontSize: 12,
    color: BRAND.ink
  }
};

/**
 * The text alternative to a chart.
 *
 * `columns` are `{ key, label, format? }`; `rows` are the same objects the
 * chart is drawn from, so the two can never drift apart.
 */
export const ChartFallbackTable = ({ caption, columns, rows = [] }) => (
  <table className="sr-only">
    <caption>{caption}</caption>
    <thead>
      <tr>
        {columns.map((c) => (
          <th key={c.key} scope="col">
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i}>
          {columns.map((c) => (
            <td key={c.key}>{c.format ? c.format(row[c.key]) : String(row[c.key] ?? '')}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
