// The numbers on the merchant dashboard. No framework imports, so the rules can be
// unit tested on their own.
//
// - A canceled order is never a sale: it counts in no total, chart or product list.
// - "Pending" and "shipped" describe the work that is open now, so they are counted
//   over ALL orders, whatever period the dashboard shows.
// - Days are cut in the shop's time zone, not in UTC, so an order placed at 00:30 in
//   Tunis belongs to that day and not to the day before.

export const ANALYTICS_DAYS = [7, 30, 90] as const
export const DEFAULT_ANALYTICS_DAYS = 7
export const ANALYTICS_TIMEZONE = "Africa/Tunis"

const DAY_MS = 24 * 60 * 60 * 1000

export type AnalyticsFulfillment = {
  shipped_at?: unknown
  delivered_at?: unknown
  canceled_at?: unknown
}

export type AnalyticsItem = {
  title?: string | null
  quantity?: unknown
  thumbnail?: string | null
}

export type AnalyticsOrder = {
  total?: unknown
  status?: string | null
  created_at?: string | Date | null
  fulfillments?: AnalyticsFulfillment[] | null
  items?: AnalyticsItem[] | null
}

export type DailyBucket = { date: string; sales: number; count: number }

export type TopProduct = { title: string; quantity: number; thumbnail: string | null }

// The period asked for (?days=). Anything that is not 7, 30 or 90 gives 7.
export function parseDays(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value
  const days = Number(raw)
  return (ANALYTICS_DAYS as readonly number[]).includes(days) ? days : DEFAULT_ANALYTICS_DAYS
}

// "2026-11-13" for a moment, as the calendar date in the shop's time zone.
// Empty text for a value that is not a date.
export function dayKey(value: unknown, timeZone: string = ANALYTICS_TIMEZONE): string {
  if (value === null || value === undefined || value === "") return ""
  const date = value instanceof Date ? value : new Date(value as string | number)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

// The last `days` calendar days, oldest first, ending today.
export function lastDayKeys(days: number, now: Date, timeZone: string = ANALYTICS_TIMEZONE): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(now.getTime() - i * DAY_MS), timeZone))
  }
  return keys
}

// Orders created before this moment cannot be in the period. One extra day is
// added so a time zone offset never cuts off the first day.
export function periodStart(days: number, now: Date): Date {
  return new Date(now.getTime() - (days + 1) * DAY_MS)
}

function amount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function isCounted(order: AnalyticsOrder): boolean {
  return (order.status || "").toLowerCase() !== "canceled"
}

function isShipped(order: AnalyticsOrder): boolean {
  const active = (order.fulfillments || []).filter((f) => f && !f.canceled_at)
  return active.some((f) => f.shipped_at || f.delivered_at)
}

export type AnalyticsSummary = {
  total_sales: number
  total_orders: number
  all_time_sales: number
  all_time_orders: number
  pending_orders: number
  fulfilled_orders: number
  daily_sales: DailyBucket[]
}

// `orders` are all the orders of the shop. Totals and the chart cover the last
// `days` days; the all time numbers and the pending / shipped counts cover every order.
export function summarizeOrders(
  orders: AnalyticsOrder[],
  days: number,
  now: Date,
  timeZone: string = ANALYTICS_TIMEZONE
): AnalyticsSummary {
  const keys = lastDayKeys(days, now, timeZone)
  const buckets = new Map<string, DailyBucket>(keys.map((key) => [key, { date: key, sales: 0, count: 0 }]))

  let allTimeSales = 0
  let allTimeOrders = 0
  let periodSales = 0
  let periodOrders = 0
  let pending = 0
  let fulfilled = 0

  for (const order of orders) {
    if (!isCounted(order)) continue
    const total = amount(order.total)

    allTimeSales += total
    allTimeOrders += 1
    if (isShipped(order)) fulfilled += 1
    else pending += 1

    const bucket = buckets.get(dayKey(order.created_at, timeZone))
    if (bucket) {
      bucket.sales += total
      bucket.count += 1
      periodSales += total
      periodOrders += 1
    }
  }

  return {
    total_sales: periodSales,
    total_orders: periodOrders,
    all_time_sales: allTimeSales,
    all_time_orders: allTimeOrders,
    pending_orders: pending,
    fulfilled_orders: fulfilled,
    daily_sales: keys.map((key) => buckets.get(key) as DailyBucket),
  }
}

// The five products that sold most in the period, by quantity.
export function topProducts(
  orders: AnalyticsOrder[],
  days: number,
  now: Date,
  timeZone: string = ANALYTICS_TIMEZONE,
  limit = 5
): TopProduct[] {
  const keys = new Set(lastDayKeys(days, now, timeZone))
  const sold = new Map<string, TopProduct>()

  for (const order of orders) {
    if (!isCounted(order) || !keys.has(dayKey(order.created_at, timeZone))) continue
    for (const item of order.items || []) {
      if (!item || !item.title) continue
      const entry = sold.get(item.title) ?? { title: item.title, quantity: 0, thumbnail: null }
      entry.quantity += amount(item.quantity)
      if (!entry.thumbnail && item.thumbnail) entry.thumbnail = item.thumbnail
      sold.set(item.title, entry)
    }
  }

  return [...sold.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit)
}
