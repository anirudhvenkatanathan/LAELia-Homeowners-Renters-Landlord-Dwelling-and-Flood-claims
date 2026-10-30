import React from 'react';
import { ResponsiveLine } from '@nivo/line';
import type { TrendPoint } from '../../models/dashboard/executiveOverviewModel';

interface AreaTrendChartProps {
  data: TrendPoint[];
  color: string;
  valueFormat: (value: number) => string;
  yMin?: number;
  yMax?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const AreaTrendChart: React.FC<AreaTrendChartProps> = ({ data, color, valueFormat, yMin, yMax, xAxisLabel, yAxisLabel }) => {
  const series = [
    {
      id: 'trend',
      data: data.map((point) => ({ x: point.month, y: point.value })),
    },
  ];

  return (
    <ResponsiveLine
      data={series}
      margin={{ top: 36, right: 24, bottom: 50, left: 24 }}
      xScale={{ type: 'point' }}
      yScale={{ type: 'linear', min: yMin ?? 'auto', max: yMax ?? 'auto', stacked: false }}
      curve="monotoneX"
      colors={[color]}
      lineWidth={2}
      enableArea
      areaOpacity={0.15}
      enableGridX={false}
      enableGridY={false}
      axisBottom={{
        tickSize: 0,
        tickPadding: 8,
        legend: xAxisLabel,
        legendOffset: 36,
        legendPosition: 'middle',
      }}
      axisLeft={null}
      pointSize={6}
      pointColor="#ffffff"
      pointBorderWidth={2}
      pointBorderColor={color}
      enablePointLabel
      pointLabel={(point) => valueFormat(point.data.y as number)}
      pointLabelYOffset={-14}
      enableSlices={false}
      useMesh
      theme={{
        axis: { ticks: { text: { fontSize: 10, fill: '#9ca3af' } } },
        grid: { line: { stroke: '#eef2f7', strokeWidth: 1 } },
      }}
    />
  );
};

export default AreaTrendChart;
