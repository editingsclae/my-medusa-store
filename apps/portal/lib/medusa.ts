const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "https://api.getcardy.shop"

export interface MerchantUser {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  metadata?: Record<string, any> | null
}

export interface MerchantProfile {
  user: MerchantUser
  sales_channel: {
    id: string
    name: string
    description?: string | null
  }
  stock_location_id?: string
  currency_code: string
  is_super_admin: boolean
}

export interface MerchantAnalytics {
  total_sales: number
  total_orders: number
  pending_orders: number
  fulfilled_orders: number
  currency_code: string
  daily_sales: {
    date: string
    sales: number
    count: number
  }[]
  top_products: {
    title: string
    quantity: number
    thumbnail?: string | null
    thumbnailUrl?: string | null
  }[]
}

export interface ProductPrice {
  currency_code: string
  amount: number
}

export interface ProductVariant {
  id: string
  title: string
  prices?: ProductPrice[]
  inventory_quantity?: number
}

export interface MerchantProduct {
  id: string
  title: string
  handle?: string
  subtitle?: string | null
  description?: string | null
  thumbnail?: string | null
  status: "draft" | "proposed" | "published" | "rejected"
  variants?: ProductVariant[]
  images?: { id: string; url: string }[]
  categories?: { id: string; name: string }[]
  created_at: string
}

export interface MerchantCategory {
  id: string
  name: string
  handle: string
  description?: string | null
  is_active?: boolean
  rank?: number | null
  product_count?: number
  created_at?: string
  updated_at?: string
}

export interface MerchantOrderLineItem {
  id: string
  title: string
  quantity: number
  unit_price: number
  thumbnail?: string | null
  variant_title?: string | null
  variant_sku?: string | null
  variant?: {
    id?: string
    title?: string
    sku?: string
  }
}

export interface MerchantOrder {
  id: string
  display_id?: number
  status: string
  email?: string
  payment_status?: string
  fulfillment_status?: string
  created_at: string
  currency_code: string
  total: number
  subtotal?: number
  item_subtotal?: number
  item_total?: number
  item_tax_total?: number
  original_total?: number
  tax_total?: number
  shipping_total?: number
  shipping_subtotal?: number
  discount_total?: number
  sales_channel_id?: string
  sales_channel?: {
    id?: string
    name?: string
  }
  shipping_methods?: {
    id: string
    name?: string
    amount: number
    shipping_option_id?: string
  }[]
  customer?: {
    id?: string
    email: string
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
  }
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    postal_code?: string | null
    country_code?: string | null
    phone?: string | null
  }
  billing_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    postal_code?: string | null
    country_code?: string | null
    phone?: string | null
  }
  items?: MerchantOrderLineItem[]
  fulfillments?: {
    id: string
    shipped_at?: string | null
    delivered_at?: string | null
    canceled_at?: string | null
    created_at?: string
    labels?: { tracking_number: string; tracking_url?: string }[]
    items?: { id: string; quantity: number; line_item_id?: string }[]
  }[]
  payment_collections?: {
    id?: string
    status?: string
    amount?: number
    captured_amount?: number
    refunded_amount?: number
    payments?: {
      id: string
      amount: number
      currency_code: string
      provider_id?: string
      captured_at?: string | null
      created_at?: string
      captures?: { id: string; amount: number; created_at?: string }[]
      refunds?: { id: string; amount: number; created_at?: string }[]
    }[]
  }[]
}

// Token helper
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("merchant_token")
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem("merchant_token", token)
  document.cookie = `merchant_token=${token}; path=/; max-age=2592000; SameSite=Lax`
}

export function removeStoredToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem("merchant_token")
  document.cookie = "merchant_token=; path=/; max-age=0"
}

// Base Fetch Helper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken()
  const headers = new Headers(options.headers || {})

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  const url = `${BACKEND_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let errorMsg = `API Error ${res.status}`
    try {
      const errJson = await res.json()
      errorMsg = errJson.message || errJson.error || errorMsg
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }

  return res.json() as Promise<T>
}

// Authentication
export async function loginMerchant(email: string, password: string): Promise<{ token: string; profile: MerchantProfile }> {
  // Step 1: Authenticate with Medusa v2 user auth
  const authRes = await apiFetch<{ token: string }>("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })

  if (!authRes.token) {
    throw new Error("Authentication failed: No token returned")
  }

  setStoredToken(authRes.token)

  // Step 2: Validate merchant context & sales channel
  const profileRes = await apiFetch<MerchantProfile>("/admin/merchant/me", {
    headers: {
      Authorization: `Bearer ${authRes.token}`,
    },
  })

  return {
    token: authRes.token,
    profile: profileRes,
  }
}

export async function getMerchantMe(): Promise<MerchantProfile> {
  return apiFetch<MerchantProfile>("/admin/merchant/me")
}

// Analytics
export async function getMerchantAnalytics(): Promise<MerchantAnalytics> {
  const res = await apiFetch<{ analytics: MerchantAnalytics }>("/admin/merchant/analytics")
  return res.analytics
}

// Products
export async function getMerchantProducts(params?: {
  limit?: number
  offset?: number
  q?: string
  status?: string
}): Promise<{ products: MerchantProduct[]; count: number }> {
  const qParams = new URLSearchParams()
  if (params?.limit) qParams.set("limit", String(params.limit))
  if (params?.offset) qParams.set("offset", String(params.offset))
  if (params?.q) qParams.set("q", params.q)
  if (params?.status) qParams.set("status", params.status)

  const queryString = qParams.toString() ? `?${qParams.toString()}` : ""
  return apiFetch<{ products: MerchantProduct[]; count: number }>(`/admin/merchant/products${queryString}`)
}

export async function createMerchantProduct(data: {
  title: string
  subtitle?: string
  description?: string
  thumbnail?: string
  images?: string[]
  price: number
  currency_code?: string
  inventory_quantity?: number
  status?: "draft" | "published"
  category_ids?: string[]
}): Promise<{ product: MerchantProduct }> {
  return apiFetch<{ product: MerchantProduct }>("/admin/merchant/products", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteMerchantProduct(id: string): Promise<{ id: string; object: string; deleted: boolean }> {
  return apiFetch(`/admin/merchant/products/${id}`, {
    method: "DELETE",
  })
}

export async function updateMerchantProduct(
  id: string,
  data: {
    title?: string
    subtitle?: string
    description?: string
    thumbnail?: string | null
    images?: string[]
    price?: number
    currency_code?: string
    inventory_quantity?: number
    status?: "draft" | "published"
    // Replaces the product's categories. An empty array clears them.
    category_ids?: string[]
  }
): Promise<{ product: MerchantProduct }> {
  return apiFetch<{ product: MerchantProduct }>(`/admin/merchant/products/${id}`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// Categories (each merchant has its own list)
export async function getMerchantCategories(): Promise<{ categories: MerchantCategory[]; count: number }> {
  return apiFetch<{ categories: MerchantCategory[]; count: number }>("/admin/merchant/categories")
}

export async function createMerchantCategory(data: {
  name: string
  description?: string
}): Promise<{ category: MerchantCategory }> {
  return apiFetch<{ category: MerchantCategory }>("/admin/merchant/categories", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateMerchantCategory(
  id: string,
  data: { name?: string; description?: string; is_active?: boolean }
): Promise<{ category: MerchantCategory }> {
  return apiFetch<{ category: MerchantCategory }>(`/admin/merchant/categories/${id}`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteMerchantCategory(id: string): Promise<{ id: string; object: string; deleted: boolean }> {
  return apiFetch(`/admin/merchant/categories/${id}`, {
    method: "DELETE",
  })
}

// Media Upload (Cloudflare R2)
// Single upload — appends file once under "files" field only.
// No silent fallback: if the merchant endpoint succeeds but returns no URL we throw immediately
// rather than calling a second endpoint and uploading to R2 a second time.
export async function uploadMerchantMedia(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData()
  // IMPORTANT: append the file exactly ONCE. Appending under two field names
  // caused multer's upload.any() to receive two entries and upload duplicates to R2.
  formData.append("files", file)

  const res = await apiFetch<{ files?: { url: string; id?: string; key?: string }[] }>("/admin/merchant/upload", {
    method: "POST",
    body: formData,
  })

  if (!res.files?.[0]?.url) {
    throw new Error("Upload failed: No file URL returned from storage")
  }

  return {
    url: res.files[0].url,
    key: res.files[0].id || res.files[0].key || "",
  }
}

// Orders
export async function getMerchantOrders(params?: {
  limit?: number
  offset?: number
}): Promise<{ orders: MerchantOrder[]; count: number }> {
  const qParams = new URLSearchParams()
  if (params?.limit) qParams.set("limit", String(params.limit))
  if (params?.offset) qParams.set("offset", String(params.offset))

  const queryString = qParams.toString() ? `?${qParams.toString()}` : ""
  return apiFetch<{ orders: MerchantOrder[]; count: number }>(`/admin/merchant/orders${queryString}`)
}

export async function getMerchantOrder(id: string): Promise<{ order: MerchantOrder }> {
  return apiFetch<{ order: MerchantOrder }>(`/admin/merchant/orders/${id}`)
}

export async function getFulfillmentContext(orderId: string): Promise<{
  location_id: string | null
  location_name: string
  shipping_methods: { id: string; name?: string; shipping_option_id?: string; amount: number }[]
  items: { id: string; title: string; quantity: number; unit_price: number; variant_title?: string | null; thumbnail?: string | null }[]
}> {
  return apiFetch(`/admin/merchant/orders/${orderId}/fulfillments`)
}

export async function fulfillMerchantOrder(
  orderId: string,
  data: {
    location_id?: string
    shipping_option_id?: string
    tracking_number?: string
    tracking_url?: string
    items?: { id: string; quantity: number }[]
  }
): Promise<{ fulfillment: any }> {
  return apiFetch<{ fulfillment: any }>(`/admin/merchant/orders/${orderId}/fulfillments`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function shipMerchantOrder(
  orderId: string,
  data: {
    fulfillment_id?: string
    tracking_number?: string
    tracking_url?: string
    items?: { id: string; quantity: number }[]
  }
): Promise<{ shipment: any }> {
  return apiFetch<{ shipment: any }>(`/admin/merchant/orders/${orderId}/shipments`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deliverMerchantOrder(
  orderId: string,
  data?: {
    fulfillment_id?: string
  }
): Promise<{ result: any }> {
  return apiFetch<{ result: any }>(`/admin/merchant/orders/${orderId}/deliver`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  })
}

export async function captureMerchantPayment(
  orderId: string,
  data?: {
    payment_id?: string
    amount?: number
  }
): Promise<{ payment: any }> {
  return apiFetch<{ payment: any }>(`/admin/merchant/orders/${orderId}/capture-payment`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  })
}

// Customers
export interface CustomerAddress {
  id?: string
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

export interface MerchantCustomer {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  name?: string
  phone?: string | null
  has_account?: boolean
  account_status?: "Registered" | "Guest"
  created_at: string
  addresses?: CustomerAddress[]
  orders?: MerchantOrder[]
}

export async function getMerchantCustomers(params?: {
  limit?: number
  offset?: number
  q?: string
}): Promise<{ customers: MerchantCustomer[]; count: number }> {
  const qParams = new URLSearchParams()
  if (params?.limit) qParams.set("limit", String(params.limit))
  if (params?.offset) qParams.set("offset", String(params.offset))
  if (params?.q) qParams.set("q", params.q)

  const queryString = qParams.toString() ? `?${qParams.toString()}` : ""
  return apiFetch<{ customers: MerchantCustomer[]; count: number }>(`/admin/merchant/customers${queryString}`)
}

export async function getMerchantCustomer(id: string): Promise<{ customer: MerchantCustomer; orders: MerchantOrder[] }> {
  return apiFetch<{ customer: MerchantCustomer; orders: MerchantOrder[] }>(`/admin/merchant/customers/${id}`)
}
