// client/src/components/admin/LineChart.js
import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatNumber } from '../../utils/chartUtils';
import { AXIS_PROPS, BRAND, BRAND_SERIES, TOOLTIP_PROPS, ChartFallbackTable } from './chartTheme';

const LineChart = ({
  data = [],
  xKey = 'date',
  yKeys = [{ key: 'value', name: 'Value' }],
  height = 300,
  caption = 'Line chart data'
}) => (
  <figure className="m-0">
    <div aria-hidden="true">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={BRAND.grid} vertical={false} />
          <XAxis dataKey={xKey} {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} width={44} />
          <Tooltip formatter={(value) => formatNumber(value)} {...TOOLTIP_PROPS} />
          <Legend wrapperStyle={{ fontSize: 12, color: BRAND.inkMuted }} />
          {yKeys.map((yKey, i) => {
            const stroke = yKey.color || BRAND_SERIES[i % BRAND_SERIES.length];
            return (
              <Line
                key={yKey.key}
                type="monotone"
                dataKey={yKey.key}
                name={yKey.name}
                stroke={stroke}
                strokeWidth={2}
                dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            );
          })}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
    <ChartFallbackTable
      caption={caption}
      columns={[
        { key: xKey, label: 'Point' },
        ...yKeys.map((y) => ({ key: y.key, label: y.name, format: formatNumber }))
      ]}
      rows={data}
    />
  </figure>
);

export default LineChart;
