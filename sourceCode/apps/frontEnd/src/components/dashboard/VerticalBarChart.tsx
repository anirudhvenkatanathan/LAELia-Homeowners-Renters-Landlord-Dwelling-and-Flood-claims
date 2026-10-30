import React from 'react';
import type { TrendPoint } from '../../models/dashboard/executiveOverviewModel';

interface VerticalBarChartProps {
  data: TrendPoint[];
  color: string;
  valueFormat: (value: number) => string;
  yMax?: number;
}

const CHART_WIDTH        = 320;
const CHART_HEIGHT       = 160;
const BAR_GAP            = 12;
const AXIS_LABEL_HEIGHT  = 20;
const VALUE_LABEL_HEIGHT = 16;

const VerticalBarChart: React.FC<VerticalBarChartProps> = ({ data, color, valueFormat, yMax }) => {
  const max = yMax ?? Math.max(...data.map((d) => d.value), 1);
  const plotHeight = CHART_HEIGHT - AXIS_LABEL_HEIGHT - VALUE_LABEL_HEIGHT;
  const barWidth = (CHART_WIDTH - BAR_GAP * (data.length + 1)) / data.length;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      style={{ width: '100%', height: '100%' }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Bar chart"
    >
      {data.map((point, i) => {
        const barHeight = Math.max(2, (point.value / max) * plotHeight);
        const x = BAR_GAP + i * (barWidth + BAR_GAP);
        const y = VALUE_LABEL_HEIGHT + (plotHeight - barHeight);
        return (
          <g key={point.month}>
            <text x={x + barWidth / 2} y={VALUE_LABEL_HEIGHT - 4} textAnchor="middle" className="eo-vbar-value-label">
              {valueFormat(point.value)}
            </text>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={3} fill={color} />
            <text x={x + barWidth / 2} y={CHART_HEIGHT - 4} textAnchor="middle" className="eo-vbar-axis-label">
              {point.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default VerticalBarChart;
