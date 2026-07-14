/**
 * Shared analytics component library (spec §5) + metric helpers.
 * Import everything a module analytics panel needs from here:
 *
 *   import {
 *     AnalyticsHeader, ChartCard, StatTile,
 *     AgingBucketChart, ComplianceGauge, CategoryParetoChart, TrendLineChart,
 *     DonutChart, BarSplit, HBarSplit, FunnelChart, HeatMapMatrix,
 *     ScorecardTable, CalendarList,
 *     // metrics
 *     daysSince, agingByCreation, openClosedTrend, pareto, countBy, …
 *   } from '@/components/analytics';
 */
export * from './kit';
export * from './metrics';

export { default as AgingBucketChart } from './AgingBucketChart';
export type { AgingBucketChartProps } from './AgingBucketChart';
export { default as ComplianceGauge } from './ComplianceGauge';
export type { ComplianceGaugeProps } from './ComplianceGauge';
export { default as CategoryParetoChart } from './CategoryParetoChart';
export type { CategoryParetoChartProps } from './CategoryParetoChart';
export { default as TrendLineChart } from './TrendLineChart';
export type { TrendLineChartProps, TrendSeries } from './TrendLineChart';
export { default as DonutChart, BarSplit, HBarSplit } from './DonutChart';
export { default as FunnelChart } from './FunnelChart';
export type { FunnelChartProps } from './FunnelChart';
export { default as HeatMapMatrix } from './HeatMapMatrix';
export type { HeatMapMatrixProps } from './HeatMapMatrix';
export { default as ScorecardTable, scorePill } from './ScorecardTable';
export type { ScorecardColumn, ScorecardTableProps } from './ScorecardTable';
export { default as CalendarList } from './CalendarList';
export type { CalendarEntry, CalendarListProps } from './CalendarList';
