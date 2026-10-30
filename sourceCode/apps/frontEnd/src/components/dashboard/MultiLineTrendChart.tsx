import React from 'react';
import { ResponsiveLine } from '@nivo/line';
import type { LaeTrendPoint } from '../../models/dashboard/executiveOverviewModel';

export interface TrendLineSeries {
  key: keyof Omit<LaeTrendPoint, 'month'>;
  label: string;
  color: string;
}

interface MultiLineTrendChartProps {
  data: LaeTrendPoint[];
  series: TrendLineSeries[];
  valueFormat: (value: number) => string;
  yMin?: number | 'auto';
  yMax?: number | 'auto';
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const MultiLineTrendChart: React.FC<MultiLineTrendChartProps> = ({ data, series, valueFormat, yMin, yMax, xAxisLabel, yAxisLabel }) => {
  const lines = series.map((s) => ({
    id: s.label,
    data: data.map((point) => ({ x: point.month, y: point[s.key] })),
  }));

  return (
    <ResponsiveLine
      data={lines}
      margin={{ top: 36, right: 24, bottom: 60, left: 24 }}
      xScale={{ type: 'point' }}
      yScale={{ type: 'linear', min: yMin ?? 'auto', max: yMax ?? 'auto', stacked: false }}
      curve="monotoneX"
      colors={series.map((s) => s.color)}
      lineWidth={2}
      enableArea={false}
      enableGridX={false}
      enableGridY
      axisBottom={{
        tickSize: 0,
        tickPadding: 10,
        tickRotation: -30,
        legend: xAxisLabel,
        legendOffset: 46,
        legendPosition: 'middle',
      }}
      axisLeft={null}
      pointSize={6}
      pointColor={{ theme: 'background' }}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      enableSlices="x"
      sliceTooltip={({ slice }) => (
        <div style={{ background: '#fff', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }}>
          <strong>{slice.points[0]?.data.xFormatted}</strong>
          {slice.points.map((point) => (
            <div key={point.id} style={{ color: point.seriesColor }}>
              {point.seriesId}: {valueFormat(point.data.y as number)}
            </div>
          ))}
        </div>
      )}
      useMesh
      theme={{
        axis: { ticks: { text: { fontSize: 10, fill: '#9ca3af' } } },
        grid: { line: { stroke: '#eef2f7', strokeWidth: 1 } },
        legends: { text: { fontSize: 11, fill: '#374151' } },
      }}
    />
  );
};

export default MultiLineTrendChart;
