// client/src/components/admin/BarChart.js
import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatNumber } from '../../utils/chartUtils';
import { AXIS_PROPS, BRAND, BRAND_SERIES, TOOLTIP_PROPS, ChartFallbackTable } from './chartTheme';

const BarChart = ({
  data = [],
  xKey = 'name',
  yKeys = [{ key: 'value', name: 'Value' }],
  height = 300,
  caption = 'Bar chart data'
}) => (
  <figure className="m-0">
    <div aria-hidden="true">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={BRAND.grid} vertical={false} />
          <XAxis dataKey={xKey} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={44} />
          <Tooltip formatter={(value) => formatNumber(value)} {...TOOLTIP_PROPS} />
          <Legend wrapperStyle={{ fontSize: 12, color: BRAND.inkMuted }} />
          {yKeys.map((yKey, i) => (
            <Bar
              key={yKey.key}
              dataKey={yKey.key}
              name={yKey.name}
              radius={[6, 6, 0, 0]}
              fill={yKey.color || BRAND_SERIES[i % BRAND_SERIES.length]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
    <ChartFallbackTable
      caption={caption}
      columns={[
        { key: xKey, label: 'Category' },
        ...yKeys.map((y) => ({ key: y.key, label: y.name, format: formatNumber }))
      ]}
      rows={data}
    />
  </figure>
);

export default BarChart;
