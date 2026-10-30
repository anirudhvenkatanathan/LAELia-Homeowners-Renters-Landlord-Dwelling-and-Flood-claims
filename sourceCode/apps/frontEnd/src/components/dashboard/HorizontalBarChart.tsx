import React from 'react';

export interface HorizontalBarItem {
  label: string;
  value: number;
  colorClass?: string;
}

interface HorizontalBarChartProps {
  data: HorizontalBarItem[];
  valueFormat: (value: number) => string;
  maxValue?: number;
  /** Axis tick values (e.g. [0, 50, 100] for percentage charts). */
  axisTicks?: number[];
}

const LABEL_WIDTH    = 170;
const VALUE_WIDTH    = 64;
const BAR_AREA_WIDTH = 280;
const ROW_HEIGHT     = 26;
const ROW_GAP        = 10;
const AXIS_HEIGHT    = 18;

const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({ data, valueFormat, maxValue, axisTicks }) => {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const totalWidth = LABEL_WIDTH + BAR_AREA_WIDTH + VALUE_WIDTH;
  const rowsHeight = data.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP;
  const totalHeight = rowsHeight + (axisTicks ? AXIS_HEIGHT : 0);

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      style={{ width: '100%', height: '100%' }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Horizontal bar chart"
    >
      {axisTicks?.map((tick) => {
        const x = LABEL_WIDTH + (tick / max) * BAR_AREA_WIDTH;
        return (
          <g key={tick}>
            <line x1={x} y1={0} x2={x} y2={rowsHeight} stroke="#eef2f7" strokeWidth={1} />
            <text x={x} y={totalHeight - 4} textAnchor="middle" className="eo-hbar-axis-label">{tick}%</text>
          </g>
        );
      })}

      {data.map((item, i) => {
        const y = i * (ROW_HEIGHT + ROW_GAP);
        const barWidth = Math.max(2, (item.value / max) * BAR_AREA_WIDTH);
        return (
          <g key={item.label}>
            <text x={0} y={y + ROW_HEIGHT / 2 + 4} className="eo-hbar-name-label">{item.label}</text>
            <rect
              x={LABEL_WIDTH}
              y={y}
              width={barWidth}
              height={ROW_HEIGHT}
              rx={3}
              className={item.colorClass ?? 'eo-hbar--primary'}
            />
            <text x={LABEL_WIDTH + barWidth + 8} y={y + ROW_HEIGHT / 2 + 4} className="eo-hbar-value-label">
              {valueFormat(item.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default HorizontalBarChart;
