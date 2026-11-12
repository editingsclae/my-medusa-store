// Types used by the dashboard components. There is no sample data here: every number
// on the dashboard comes from GET /admin/merchant/analytics.

export interface DailyRevenue {
  dayIndex: number;
  dateUtc: number;
  dateShort: string;
  dateFull: string;
  revenue: number;
  revenueFormatted: string;
}

export interface KpiData {
  title: string;
  value: string;
  // The change pill is drawn only when the backend gives a real comparison.
  delta?: string;
  isUp?: boolean;
  deltaCaption: string;
  iconName: 'dollar' | 'cart' | 'truck';
  // The sparkline is drawn only with at least two real points.
  sparklineSeries?: number[];
  sparklineAriaLabel?: string;
}
