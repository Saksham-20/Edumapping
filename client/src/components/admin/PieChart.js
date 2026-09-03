// client/src/components/admin/PieChart.js
import React from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatNumber } from '../../utils/chartUtils';
import { BRAND, BRAND_SERIES, TOOLTIP_PROPS, ChartFallbackTable } from './chartTheme';

const PieChart = ({
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  height = 300,
  caption = 'Pie chart data'
}) => (
  <figure className="m-0">
    <div aria-hidden="true">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            dataKey={dataKey}
            nameKey={nameKey}
            stroke="#FFFFFF"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill || BRAND_SERIES[index % BRAND_SERIES.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatNumber(value)} {...TOOLTIP_PROPS} />
          <Legend wrapperStyle={{ fontSize: 12, color: BRAND.inkMuted }} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
    <ChartFallbackTable
      caption={caption}
      columns={[
        { key: nameKey, label: 'Category' },
        { key: dataKey, label: 'Value', format: formatNumber }
      ]}
      rows={data}
    />
  </figure>
);

export default PieChart;
