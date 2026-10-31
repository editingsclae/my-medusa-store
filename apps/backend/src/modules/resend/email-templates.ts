// The emails the store sends, as plain HTML and text. No framework imports, so
// the rules can be unit tested on their own.
//
// Everything that comes from an order or a merchant (names, addresses, product
// titles) goes through escapeHtml before it is put in the HTML. Prices are
// shown the way the storefront shows them: "TND 700.00".

export const EMAIL_TEMPLATES = {
  ORDER_PLACED: "order-placed",
} as const

export type EmailTemplateName = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES]

export type RenderedEmail = {
  subject: string
  html: string
  text: string
  // The store the email is about. Shown as the sender name.
  fromName: string | null
}

export type EmailOrderItem = {
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  quantity?: unknown
  unit_price?: unknown
}

export type EmailOrderAddress = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

// The part of an order the order confirmation uses
export type EmailOrder = {
  id: string
  display_id?: number | string | null
  email?: string | null
  currency_code?: string | null
  customer_id?: string | null
  sales_channel?: { name?: string | null } | null
  items?: EmailOrderItem[] | null
  shipping_address?: EmailOrderAddress | null
  shipping_methods?: Array<{ name?: string | null }> | null
  item_subtotal?: unknown
  shipping_subtotal?: unknown
  discount_total?: unknown
  tax_total?: unknown
  total?: unknown
}

export class EmailDataError extends Error {}

// -------------------------------------------------------------
// Small helpers
// -------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Text for a single line (a subject, a name): line breaks and control
// characters become spaces, so nothing can add a header or break the layout.
export function oneLine(value: unknown, max = 200): string {
  let text = ""
  for (const char of String(value ?? "")) {
    const code = char.charCodeAt(0)
    const control = code < 32 || code === 127 || code === 0x2028 || code === 0x2029
    text += control ? " " : char
  }
  text = text.replace(/\s+/g, " ").trim()
  return text.length > max ? text.slice(0, max).trim() : text
}

// Amounts come out of the database as numbers, numeric strings or big number
// objects. Anything else is 0.
export function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  if (value && typeof value === "object") {
    const raw = value as { numeric_?: unknown; value?: unknown }
    if (raw.numeric_ !== undefined) return toNumber(raw.numeric_)
    if (raw.value !== undefined) return toNumber(raw.value)
  }
  return 0
}

export function formatMoney(amount: unknown, currency: string | null | undefined): string {
  const code = oneLine(currency, 3).toUpperCase()
  const value = toNumber(amount).toFixed(2)
  return code ? `${code} ${value}` : value
}

// Only http(s) pictures are put in an email
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2000 || /\s/.test(value)) {
    return null
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

// The sender: the configured address with the store's name in front, for
// example "ZARA <orders@getcardy.shop>". The name is cleaned so it cannot look
// like another address or break the header. Without a usable name the
// configured value is used as it is.
export function formatFrom(configured: string, storeName: string | null | undefined): string {
  const match = configured.match(/<([^<>]+)>\s*$/)
  const address = (match ? match[1] : configured).trim()

  const name = oneLine(storeName, 200)
    .replace(/[<>"\\,;:@()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim()

  return name ? `${name} <${address}>` : configured
}

// -------------------------------------------------------------
// Order confirmation
// -------------------------------------------------------------

// "TN" becomes "Tunisia". An unknown code is shown as it is.
export function countryName(code: unknown): string {
  const upper = oneLine(code, 2).toUpperCase()
  if (upper.length !== 2) return ""
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(upper) || upper
  } catch {
    return upper
  }
}

// Medusa gives a product without options a placeholder variant title. It says
// nothing to the buyer, so it is not shown.
function isPlaceholderVariant(title: string): boolean {
  return /^default( variant| option value| title)?$/i.test(title)
}

type Line = { name: string; variant: string; quantity: number; unit: string; total: string; image: string | null }

function orderLines(order: EmailOrder): Line[] {
  const currency = order.currency_code
  return (order.items || [])
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const name = oneLine(item.product_title || item.title || "Item", 200)
      const variant = oneLine(item.variant_title, 100)
      const quantity = Math.max(0, Math.round(toNumber(item.quantity)))
      const unit = toNumber(item.unit_price)
      return {
        name,
        variant: variant && variant !== name && !isPlaceholderVariant(variant) ? variant : "",
        quantity,
        unit: formatMoney(unit, currency),
        total: formatMoney(unit * quantity, currency),
        image: safeHttpUrl(item.thumbnail),
      }
    })
}

function addressLines(address: EmailOrderAddress | null | undefined): string[] {
  if (!address) return []
  const name = oneLine([address.first_name, address.last_name].filter(Boolean).join(" "), 120)
  const city = oneLine(address.city, 120)
  const place = oneLine([address.postal_code, city].filter(Boolean).join(" "), 120)
  const province = oneLine(address.province, 120)
  return [
    name,
    oneLine(address.address_1, 200),
    oneLine(address.address_2, 200),
    place,
    // A province that only repeats the city is left out
    province.toLowerCase() === city.toLowerCase() ? "" : province,
    countryName(address.country_code),
    address.phone ? `Phone: ${oneLine(address.phone, 40)}` : "",
  ].filter((line) => line.length > 0)
}

type SummaryRow = { label: string; value: string; strong?: boolean }

function summaryRows(order: EmailOrder): SummaryRow[] {
  const currency = order.currency_code
  const method = oneLine(order.shipping_methods?.[0]?.name, 100)
  const rows: SummaryRow[] = [
    { label: "Subtotal", value: formatMoney(order.item_subtotal, currency) },
    { label: method ? `Delivery (${method})` : "Delivery", value: formatMoney(order.shipping_subtotal, currency) },
  ]
  // Shown only when there is something to show: a store without a discount or
  // a tax has no such row.
  if (toNumber(order.discount_total) > 0) {
    rows.push({ label: "Discount", value: `-${formatMoney(order.discount_total, currency)}` })
  }
  if (toNumber(order.tax_total) > 0) {
    rows.push({ label: "Tax", value: formatMoney(order.tax_total, currency) })
  }
  rows.push({ label: "Total", value: formatMoney(order.total, currency), strong: true })
  return rows
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function renderOrderPlaced(data: Record<string, unknown> | null | undefined): RenderedEmail {
  const order = data?.order as EmailOrder | undefined
  if (!order || typeof order !== "object" || !order.id) {
    throw new EmailDataError("The order-placed email needs data.order with an id")
  }

  const store = oneLine(order.sales_channel?.name, 60)
  const display = oneLine(order.display_id ?? order.id, 40)
  const firstName = oneLine(order.shipping_address?.first_name, 60)
  const lines = orderLines(order)
  const summary = summaryRows(order)
  const address = addressLines(order.shipping_address)

  const subject = store
    ? `Your order #${display} from ${store} is confirmed`
    : `Your order #${display} is confirmed`
  const greeting = firstName ? `Hi ${firstName},` : "Hello,"
  const intro = `We received your order #${display}. You pay in cash when it is delivered.`

  // ---- HTML
  const anyImage = lines.some((line) => line.image)
  const itemRows = lines
    .map((line) => {
      const image = line.image
        ? `<img src="${escapeHtml(line.image)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e4e4e7">`
        : ""
      const variant = line.variant
        ? `<div style="font-size:12px;color:#71717a;margin-top:2px">${escapeHtml(line.variant)}</div>`
        : ""
      return `<tr>
${anyImage ? `<td style="padding:12px 12px 12px 0;width:56px;vertical-align:top">${image}</td>` : ""}
<td style="padding:12px 0;vertical-align:top"><div style="font-size:14px;font-weight:600;color:#18181b">${escapeHtml(line.name)}</div>${variant}<div style="font-size:12px;color:#71717a;margin-top:2px">${line.quantity} x ${escapeHtml(line.unit)}</div></td>
<td style="padding:12px 0 12px 12px;vertical-align:top;text-align:right;font-size:14px;font-weight:600;color:#18181b;white-space:nowrap">${escapeHtml(line.total)}</td>
</tr>`
    })
    .join("\n")

  const summaryHtml = summary
    .map(
      (row) => `<tr>
<td style="padding:4px 0;font-size:${row.strong ? 16 : 14}px;${row.strong ? "font-weight:700;" : ""}color:${row.strong ? "#18181b" : "#52525b"}">${escapeHtml(row.label)}</td>
<td style="padding:4px 0;text-align:right;font-size:${row.strong ? 16 : 14}px;${row.strong ? "font-weight:700;" : ""}color:#18181b;white-space:nowrap">${escapeHtml(row.value)}</td>
</tr>`
    )
    .join("\n")

  const addressHtml = address.map((line) => escapeHtml(line)).join("<br>")

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7">
<tr><td style="padding:24px 28px;border-bottom:1px solid #e4e4e7;font-size:18px;font-weight:800;letter-spacing:0.04em;color:#18181b">${escapeHtml(store || "Order confirmation")}</td></tr>
<tr><td style="padding:28px 28px 8px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#18181b">Thank you for your order</h1>
<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3f3f46">${escapeHtml(greeting)}</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46">${escapeHtml(intro)}</p>
</td></tr>
<tr><td style="padding:16px 28px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e4e7">
${itemRows}
</table>
</td></tr>
<tr><td style="padding:8px 28px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e4e7;margin-top:4px;padding-top:8px">
${summaryHtml}
</table>
</td></tr>
${
  address.length > 0
    ? `<tr><td style="padding:20px 28px 0"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;margin-bottom:6px">Delivery address</div><div style="font-size:14px;line-height:1.6;color:#3f3f46">${addressHtml}</div></td></tr>`
    : ""
}
<tr><td style="padding:20px 28px 0"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;margin-bottom:6px">Payment</div><div style="font-size:14px;line-height:1.6;color:#3f3f46">Cash on delivery</div></td></tr>
<tr><td style="padding:28px;font-size:12px;line-height:1.6;color:#a1a1aa">${
    store
      ? `You received this email because you placed an order at ${escapeHtml(store)}.`
      : "You received this email because you placed an order."
  }</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  // ---- Plain text
  const textLines: string[] = [
    store || "Order confirmation",
    "",
    greeting,
    intro,
    "",
    "Items",
    ...lines.map(
      (line) =>
        `- ${line.name}${line.variant ? ` (${line.variant})` : ""}: ${line.quantity} x ${line.unit} = ${line.total}`
    ),
    "",
    ...summary.map((row) => `${row.label}: ${row.value}`),
  ]
  if (address.length > 0) {
    textLines.push("", "Delivery address", ...address)
  }
  textLines.push("", "Payment: cash on delivery")
  const text = textLines.join("\n")

  return { subject: oneLine(subject, 200), html, text, fromName: store || null }
}

// The email for a template name, or null when there is no such template
export function renderEmail(
  template: string,
  data: Record<string, unknown> | null | undefined
): RenderedEmail | null {
  switch (template) {
    case EMAIL_TEMPLATES.ORDER_PLACED:
      return renderOrderPlaced(data)
    default:
      return null
  }
}
