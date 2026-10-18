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
  created_at: string
}

export interface MerchantOrderLineItem {
  id: string
  title: string
  quantity: number
  unit_price: number
  thumbnail?: string | null
}

export interface MerchantOrder {
  id: string
  display_id?: number
  status: string
  created_at: string
  currency_code: string
  total: number
  customer?: {
    email: string
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
  }
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    city?: string | null
    postal_code?: string | null
    country_code?: string | null
  }
  items?: MerchantOrderLineItem[]
  fulfillments?: {
    id: string
    shipped_at?: string | null
    labels?: { tracking_number: string; tracking_url?: string }[]
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

// Media Upload (Cloudflare R2)
export async function uploadMerchantMedia(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData()
  formData.append("files", file)
  formData.append("file", file)

  // 1. Try scoped merchant upload endpoint first
  try {
    const res = await apiFetch<{ files?: { url: string; id?: string; key?: string }[] }>("/admin/merchant/upload", {
      method: "POST",
      body: formData,
    })

    if (res.files?.[0]?.url) {
      return {
        url: res.files[0].url,
        key: res.files[0].id || res.files[0].key || "",
      }
    }
  } catch (err: any) {
    console.warn("Merchant upload route failed, attempting fallback to /admin/uploads:", err?.message || err)
  }

  // 2. Fallback to Medusa admin uploads endpoint
  const fallbackRes = await apiFetch<{ files?: { url: string; id?: string; key?: string }[] }>("/admin/uploads", {
    method: "POST",
    body: formData,
  })

  if (!fallbackRes.files?.[0]?.url) {
    throw new Error("Upload failed: No file returned from storage")
  }

  return {
    url: fallbackRes.files[0].url,
    key: fallbackRes.files[0].id || fallbackRes.files[0].key || "",
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

export async function fulfillMerchantOrder(
  orderId: string,
  data: {
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
