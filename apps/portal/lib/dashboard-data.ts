import { ThumbnailType } from './products';

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
  delta: string;
  isUp: boolean;
  deltaCaption: string;
  iconName: 'dollar' | 'cart' | 'truck';
  sparklineSeries: number[];
  sparklineAriaLabel: string;
}

export interface PendingStage {
  label: string;
  count: number;
}

export interface TopProductItem {
  id: string;
  name: string;
  category: string;
  units: number;
  revenue: number;
  revenueFormatted: string;
  thumb: ThumbnailType;
}

export function getDailyRevenueData(): DailyRevenue[] {
  const days = 30;
  const weekly = [760, 420, -420, -260, 40, 180, 320];
  const raw: number[] = [];
  for (let i = 0; i < days; i++) {
    raw.push(3300 + i * 52 + weekly[i % 7] + Math.round(Math.sin(i * 1.7) * 230));
  }
  const sumRaw = raw.reduce((a, b) => a + b, 0);
  const vals = raw.map((r) => Math.round((r * 128450) / sumRaw));
  const sumVals = vals.reduce((a, b) => a + b, 0);
  vals[days - 1] += 128450 - sumVals;

  const shortFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });

  const fullFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return vals.map((val, i) => {
    const dateUtc = Date.UTC(2026, 8, 19 + i);
    return {
      dayIndex: i,
      dateUtc,
      dateShort: shortFmt.format(new Date(dateUtc)),
      dateFull: fullFmt.format(new Date(dateUtc)),
      revenue: val,
      revenueFormatted: '$' + val.toLocaleString('en-US'),
    };
  });
}

export const KPI_TILES_DATA: KpiData[] = [
  {
    title: 'Total revenue',
    value: '$128,450',
    delta: '+12.4%',
    isUp: true,
    deltaCaption: 'vs previous 30 days',
    iconName: 'dollar',
    sparklineSeries: [3.2, 3.5, 3.3, 3.9, 3.7, 4.1, 4.0, 4.4, 4.2, 4.6, 4.5, 4.9],
    sparklineAriaLabel: 'Revenue trend, rising',
  },
  {
    title: 'Orders',
    value: '642',
    delta: '+8.1%',
    isUp: true,
    deltaCaption: 'vs previous 30 days',
    iconName: 'cart',
    sparklineSeries: [14, 15, 14, 16, 17, 16, 18, 19, 18, 20, 19, 21],
    sparklineAriaLabel: 'Orders trend, rising',
  },
  {
    title: 'Pending fulfillment',
    value: '37',
    delta: '−4.2%',
    isUp: false,
    deltaCaption: 'vs previous 30 days',
    iconName: 'truck',
    sparklineSeries: [48, 46, 47, 44, 45, 42, 43, 41, 40, 41, 39, 37],
    sparklineAriaLabel: 'Pending fulfillment trend, falling',
  },
];

export const PENDING_STAGES_DATA: PendingStage[] = [
  { label: 'Ready to ship', count: 21 },
  { label: 'Awaiting payment', count: 8 },
  { label: 'On hold', count: 8 },
];

export const TOP_PRODUCTS_DATA: TopProductItem[] = [
  {
    id: 'top-1',
    name: 'Linen Blend Blazer',
    category: 'Co-Ord Set',
    units: 96,
    revenue: 22560,
    revenueFormatted: '$22,560',
    thumb: 'blazer',
  },
  {
    id: 'top-2',
    name: 'Cotton Man Shirt',
    category: 'Shirt',
    units: 88,
    revenue: 21560,
    revenueFormatted: '$21,560',
    thumb: 'shirt',
  },
  {
    id: 'top-3',
    name: 'Retoro Multi Sneakers',
    category: 'Shoe',
    units: 74,
    revenue: 19536,
    revenueFormatted: '$19,536',
    thumb: 'sneaker',
  },
  {
    id: 'top-4',
    name: 'Polo Sweat Shirt',
    category: 'Polo',
    units: 61,
    revenue: 14274,
    revenueFormatted: '$14,274',
    thumb: 'sweat',
  },
  {
    id: 'top-5',
    name: 'Open Back Top',
    category: 'Top',
    units: 52,
    revenue: 8476,
    revenueFormatted: '$8,476',
    thumb: 'top',
  },
];
