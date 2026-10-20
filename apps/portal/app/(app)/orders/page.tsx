'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  getMerchantOrders,
  getMerchantOrder,
  getFulfillmentContext,
  fulfillMerchantOrder,
  shipMerchantOrder,
  deliverMerchantOrder,
  captureMerchantPayment,
  MerchantOrder,
} from '@/lib/medusa';
import { SearchIcon } from '@/components/icons';

// ─── Status tones ────────────────────────────────────────────────────────────
interface StatusTone {
  fg: string;
  bd: string;
  bg: string;
  dot: string;
}

const TONES: Record<'green' | 'blue' | 'amber' | 'gray', StatusTone> = {
  green: { fg: '#17803F', bd: '#9BDDB4', bg: '#F2FBF6', dot: '#22A55B' },
  blue:  { fg: '#2563EB', bd: '#9CC3FA', bg: '#F1F7FF', dot: '#3B82F6' },
  amber: { fg: '#B45309', bd: '#F7D9A3', bg: '#FFFAF0', dot: '#F59E0B' },
  gray:  { fg: '#4B5563', bd: '#D5D9E0', bg: '#F3F4F6', dot: '#9CA3AF' },
};

function getPaymentBadgeInfo(paymentStatus?: string): { label: string; tone: StatusTone } {
  const s = (paymentStatus || 'authorized').toLowerCase();
  if (s === 'captured' || s === 'completed' || s === 'paid') {
    return { label: 'Captured', tone: TONES.green };
  }
  if (s === 'refunded' || s === 'partially_refunded') {
    return { label: 'Refunded', tone: TONES.gray };
  }
  if (s === 'canceled' || s === 'failed') {
    return { label: 'Canceled', tone: TONES.gray };
  }
  return { label: 'Authorized', tone: TONES.amber };
}

function getFulfillmentStage(order: MerchantOrder): number {
  // 0: Not fulfilled, 1: Fulfilled, 2: Shipped, 3: Delivered
  const fulfillments = order.fulfillments || [];
  if (fulfillments.length === 0) return 0;
  const anyDelivered = fulfillments.some((f) => f.delivered_at);
  if (anyDelivered) return 3;
  const anyShipped = fulfillments.some((f) => f.shipped_at);
  if (anyShipped) return 2;
  return 1;
}

function getFulfillmentBadgeInfo(stage: number): { label: string; tone: StatusTone } {
  const FUL_LABELS = ['Not fulfilled', 'Fulfilled', 'Shipped', 'Delivered'];
  const FUL_TONES: StatusTone[] = [TONES.gray, TONES.amber, TONES.blue, TONES.green];
  const idx = Math.min(Math.max(0, stage), 3);
  return { label: FUL_LABELS[idx], tone: FUL_TONES[idx] };
}

function formatMoney(amount: number, currency = 'TND'): string {
  const cur = (currency || 'TND').toUpperCase();
  const val = Number(amount || 0);
  if (cur === 'TND') {
    return `TND ${val.toFixed(3)} TND`;
  }
  return `${val.toFixed(2)} ${cur}`;
}

// Format relative date or absolute date
function formatRelative(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Tunisia Circular Flag SVG ───────────────────────────────────────────────
function TunisiaFlag() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Tunisia"
      style={{ flex: 'none', borderRadius: '50%', boxShadow: '0 0 0 1px #E6E8EC' }}
    >
      <defs>
        <clipPath id="tn-clip-orders">
          <circle cx="12" cy="12" r="11" />
        </clipPath>
      </defs>
      <g clipPath="url(#tn-clip-orders)">
        <rect width="24" height="24" fill="#E70013" />
        <circle cx="12" cy="12" r="6.6" fill="#FFFFFF" />
        <circle cx="12" cy="12" r="4.6" fill="#E70013" />
        <circle cx="13.2" cy="12" r="3.7" fill="#FFFFFF" />
        <polygon
          points="13.6,10.2 14.1,11.5 15.5,11.5 14.4,12.3 14.8,13.7 13.6,12.9 12.4,13.7 12.8,12.3 11.7,11.5 13.1,11.5"
          fill="#E70013"
        />
      </g>
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Detail view state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<MerchantOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [openShip, setOpenShip] = useState(false);
  const [openTax, setOpenTax] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fulfill Items modal state
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [fulfillLoading, setFulfillLoading] = useState(false);
  const [fulfillCtx, setFulfillCtx] = useState<{
    location_id: string | null;
    location_name: string;
    shipping_methods: { id: string; name?: string; shipping_option_id?: string; amount: number }[];
    items: { id: string; title: string; quantity: number; unit_price: number; variant_title?: string | null; thumbnail?: string | null }[];
  } | null>(null);
  const [fulfillQtys, setFulfillQtys] = useState<Record<string, number>>({});
  const [fulfillShippingOption, setFulfillShippingOption] = useState<string>('');

  // Load orders list
  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await getMerchantOrders({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setOrders(res.orders || []);
      setTotalCount(res.count ?? res.orders?.length ?? 0);
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const orderNo = `#${o.display_id || o.id}`.toLowerCase();
      const customerName = `${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`.toLowerCase();
      const email = (o.customer?.email || '').toLowerCase();
      return orderNo.includes(q) || customerName.includes(q) || email.includes(q);
    });
  }, [orders, search]);

  const listTotal = totalCount || orders.length;
  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize));

  // Open order detail
  const handleOpenDetail = async (order: MerchantOrder) => {
    setSelectedOrderId(order.id);
    setDetailOrder(order);
    setNotice(null);
    setOpenShip(false);
    setOpenTax(false);
    setCopiedKey(null);

    try {
      setDetailLoading(true);
      const res = await getMerchantOrder(order.id);
      if (res?.order) {
        setDetailOrder(res.order);
      }
    } catch (err) {
      console.error('Failed to retrieve full order detail', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedOrderId(null);
    setDetailOrder(null);
    setNotice(null);
  };

  const handleCopy = (key: string, text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Refresh single order detail
  const refreshDetail = async (orderId: string) => {
    try {
      const res = await getMerchantOrder(orderId);
      if (res?.order) {
        setDetailOrder(res.order);
      }
    } catch (err) {
      console.error('Failed to reload order detail', err);
    }
    loadOrders();
  };

  // 1. Open Fulfill Items modal – loads context from backend first
  const handleFulfillItems = useCallback(async () => {
    if (!detailOrder) return;
    setFulfillLoading(true);
    try {
      const ctx = await getFulfillmentContext(detailOrder.id);
      setFulfillCtx(ctx);
      // Pre-fill quantities from context items
      const qmap: Record<string, number> = {};
      ctx.items.forEach((it) => { qmap[it.id] = it.quantity; });
      setFulfillQtys(qmap);
      // Default shipping option to first available
      const firstOpt = ctx.shipping_methods?.[0]?.shipping_option_id || '';
      setFulfillShippingOption(firstOpt);
      setShowFulfillModal(true);
    } catch (err: any) {
      alert(`Failed to load fulfillment context: ${err.message || 'Unknown error'}`);
    } finally {
      setFulfillLoading(false);
    }
  }, [detailOrder]);

  // 1b. Confirm fulfill items from modal
  const handleConfirmFulfill = async () => {
    if (!detailOrder || !fulfillCtx) return;
    setActionLoading(true);
    try {
      const items = fulfillCtx.items
        .map((it) => ({ id: it.id, quantity: fulfillQtys[it.id] ?? it.quantity }))
        .filter((it) => it.quantity > 0);

      await fulfillMerchantOrder(detailOrder.id, {
        location_id: fulfillCtx.location_id || undefined,
        shipping_option_id: fulfillShippingOption || undefined,
        items,
      });
      setShowFulfillModal(false);
      setNotice('Items fulfilled. Ready to be shipped.');
      await refreshDetail(detailOrder.id);
    } catch (err: any) {
      alert(`Fulfillment failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Mark as Shipped (creates shipment in Medusa)
  const handleMarkShipped = async () => {
    if (!detailOrder) return;
    setActionLoading(true);
    const trackingNo = `DLS-${Math.floor(48000 + Math.random() * 500)}`;
    const fulId = detailOrder.fulfillments?.[0]?.id;
    try {
      await shipMerchantOrder(detailOrder.id, {
        fulfillment_id: fulId,
        tracking_number: trackingNo,
      });
      setNotice(`Marked as shipped. Tracking ${trackingNo} added.`);
      await refreshDetail(detailOrder.id);
    } catch (err: any) {
      alert(`Mark as shipped failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Mark as Delivered
  const handleMarkDelivered = async () => {
    if (!detailOrder) return;
    setActionLoading(true);
    const fulId = detailOrder.fulfillments?.[0]?.id;
    try {
      await deliverMerchantOrder(detailOrder.id, {
        fulfillment_id: fulId,
      });
      setNotice('Marked as delivered to the customer.');
      await refreshDetail(detailOrder.id);
    } catch (err: any) {
      alert(`Mark as delivered failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Capture Payment
  const handleCapturePayment = async () => {
    if (!detailOrder) return;
    setActionLoading(true);
    const payment = detailOrder.payment_collections?.flatMap((pc) => pc.payments || [])[0];
    try {
      await captureMerchantPayment(detailOrder.id, {
        payment_id: payment?.id,
        amount: detailOrder.total,
      });
      setNotice(`Payment captured. ${formatMoney(detailOrder.total, detailOrder.currency_code)} received.`);
      await refreshDetail(detailOrder.id);
    } catch (err: any) {
      alert(`Payment capture failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedOrderId && detailOrder) {
    const o = detailOrder;
    const stage = getFulfillmentStage(o);
    const fulInfo = getFulfillmentBadgeInfo(stage);

    const paymentCollections = o.payment_collections || [];
    const allPayments = paymentCollections.flatMap((pc) => pc.payments || []);
    const firstPayment = allPayments[0];

    // Compute captured amounts across payment collections and payment captures
    const pcCapturedTotal = paymentCollections.reduce(
      (sum, pc) => sum + (Number(pc.captured_amount) || 0),
      0
    );
    const directCapturesTotal = allPayments.reduce((sum, p) => {
      const caps = p.captures || [];
      return sum + caps.reduce((cs: number, c: any) => cs + (Number(c.amount) || 0), 0);
    }, 0);

    const rawPaymentStatus = (o.payment_status || '').toLowerCase();
    const isPaymentCaptured =
      rawPaymentStatus === 'captured' ||
      rawPaymentStatus === 'paid' ||
      rawPaymentStatus === 'completed' ||
      paymentCollections.some((pc) => pc.status === 'captured') ||
      (pcCapturedTotal > 0 && pcCapturedTotal >= (o.total || 0)) ||
      (directCapturesTotal > 0 && directCapturesTotal >= (o.total || 0)) ||
      Boolean(firstPayment?.captured_at) ||
      allPayments.some((p) => (p.captures && p.captures.length > 0));

    const payInfo = isPaymentCaptured
      ? { label: 'Captured', tone: TONES.green }
      : getPaymentBadgeInfo(o.payment_status);

    const cur = o.currency_code || 'TND';
    const items = o.items || [];

    // Exact backend values
    const itemSubtotal = o.item_subtotal !== undefined
      ? o.item_subtotal
      : o.subtotal !== undefined
      ? o.subtotal
      : items.reduce((s, it) => s + (it.unit_price || 0) * (it.quantity || 1), 0);

    const shippingTotal = o.shipping_total !== undefined
      ? o.shipping_total
      : o.shipping_subtotal !== undefined
      ? o.shipping_subtotal
      : (o.shipping_methods?.[0]?.amount || 0);

    const taxTotal = o.tax_total !== undefined
      ? o.tax_total
      : o.item_tax_total !== undefined
      ? o.item_tax_total
      : 0;

    const orderTotal = o.total;
    const isPaid = isPaymentCaptured;
    const paidTotal = isPaid
      ? (pcCapturedTotal > 0 ? pcCapturedTotal : (directCapturesTotal > 0 ? directCapturesTotal : orderTotal))
      : 0;
    const outstanding = Math.max(0, orderTotal - paidTotal);

    // Real Payment data from backend
    const paymentId = firstPayment?.id || `pay_${o.id.slice(-8)}`;
    const paymentProvider = firstPayment?.provider_id || (o.shipping_methods?.[0]?.name ? 'Manual / Store Payment' : 'Standard Provider');
    const paymentDate = firstPayment?.created_at ? new Date(firstPayment.created_at) : new Date(o.created_at);
    const canCapture = !isPaid && (payInfo.label === 'Authorized' || rawPaymentStatus === 'authorized' || rawPaymentStatus === 'awaiting');

    // Real Fulfillment data from backend
    const firstFulfillment = o.fulfillments?.[0];
    const shippingMethod = o.shipping_methods?.[0];
    const fulfillmentProvider = shippingMethod?.name || (firstFulfillment ? 'Standard Carrier' : 'Not assigned');
    const trackingNumber = firstFulfillment?.labels?.[0]?.tracking_number || (stage >= 2 ? 'Tracking assigned' : 'Not available until shipped');

    // Customer info
    const customerName = `${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`.trim() || 'Guest Customer';
    const initials = customerName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'CU';
    const email = o.customer?.email || o.email || 'customer@example.com';
    const phone = o.customer?.phone || o.shipping_address?.phone || 'No phone number';

    // Real Shipping Address
    const addr = o.shipping_address;
    const street = [addr?.address_1, addr?.address_2].filter(Boolean).join(' ') || 'No street address';
    const cityPostal = [addr?.postal_code, addr?.city].filter(Boolean).join(' ') || '';
    const country = addr?.country_code?.toUpperCase() === 'TN' ? 'Tunisia' : addr?.country_code?.toUpperCase() || 'Tunisia';

    // Real Activity timeline from order timestamps
    const activityItems: { title: string; when: string }[] = [];
    if (firstFulfillment?.delivered_at) {
      activityItems.push({ title: 'Items delivered', when: formatRelative(firstFulfillment.delivered_at) });
    }
    if (firstFulfillment?.shipped_at) {
      activityItems.push({ title: 'Items shipped', when: formatRelative(firstFulfillment.shipped_at) });
    }
    if (firstFulfillment && !firstFulfillment.canceled_at) {
      activityItems.push({
        title: 'Items fulfilled',
        when: firstFulfillment.created_at ? formatRelative(firstFulfillment.created_at) : formatRelative(o.created_at),
      });
    }
    if (firstPayment?.captured_at || isPaid) {
      activityItems.push({
        title: 'Payment captured',
        when: firstPayment?.captured_at ? formatRelative(firstPayment.captured_at) : formatRelative(o.created_at),
      });
    } else {
      activityItems.push({ title: 'Awaiting payment', when: formatRelative(o.created_at) });
    }
    activityItems.push({ title: 'Order placed', when: formatRelative(o.created_at) });

    const orderDateStr = new Date(o.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const orderTimeStr = new Date(o.created_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const displayOrderNo = `#${o.display_id || o.id.slice(-6)}`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, fontFamily: 'Urbanist, sans-serif', position: 'relative' }}>

        {/* ── Fulfill Items Modal Overlay ── */}
        {showFulfillModal && fulfillCtx && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Fulfill Items"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            {/* Backdrop */}
            <div
              onClick={() => setShowFulfillModal(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(3px)',
              }}
            />
            {/* Panel */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                background: '#FFFFFF',
                borderRadius: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                width: '100%',
                maxWidth: '540px',
                maxHeight: '90vh',
                overflowY: 'auto',
                fontFamily: 'Urbanist, sans-serif',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 16px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: '28px' }}>Fulfill Items</h2>
                <button
                  type="button"
                  onClick={() => setShowFulfillModal(false)}
                  aria-label="Close modal"
                  style={{
                    width: '32px', height: '32px', padding: 0, border: '1px solid #E6E8EC',
                    borderRadius: '50%', background: '#F9FAFB', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#6B7280',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Location field (read-only, auto from merchant warehouse) */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Location
                  </label>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px',
                      border: '1px solid #E6E8EC',
                      borderRadius: '12px',
                      background: '#F9FAFB',
                      fontSize: '15px', fontWeight: 500, color: '#111827',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                      <path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{fulfillCtx.location_name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9CA3AF', fontWeight: 400 }}>Auto-assigned</span>
                  </div>
                </div>

                {/* Shipping Method */}
                {fulfillCtx.shipping_methods.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Shipping Method
                    </label>
                    <select
                      value={fulfillShippingOption}
                      onChange={(e) => setFulfillShippingOption(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 14px',
                        border: '1px solid #E6E8EC', borderRadius: '12px',
                        background: '#F9FAFB', fontSize: '15px', fontWeight: 500,
                        color: '#111827', appearance: 'auto', cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      {fulfillCtx.shipping_methods.map((sm) => (
                        <option key={sm.id} value={sm.shipping_option_id || sm.id}>
                          {sm.name || 'Standard Shipping'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Items to Fulfill */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                    Items to Fulfill
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', border: '1px solid #E6E8EC', borderRadius: '12px', overflow: 'hidden' }}>
                    {fulfillCtx.items.map((item) => {
                      const qty = fulfillQtys[item.id] ?? item.quantity;
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 14px', background: '#FFFFFF',
                            borderBottom: '1px solid #F3F4F6',
                          }}
                        >
                          {/* Thumbnail */}
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              width={40}
                              height={40}
                              style={{ borderRadius: '8px', objectFit: 'cover', flex: 'none', border: '1px solid #E6E8EC' }}
                            />
                          ) : (
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '8px', flex: 'none',
                              background: 'linear-gradient(135deg,#F3F4F6,#E5E7EB)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
                              </svg>
                            </div>
                          )}
                          {/* Title & Variant */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title}
                            </div>
                            {item.variant_title && (
                              <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400 }}>{item.variant_title}</div>
                            )}
                          </div>
                          {/* Qty / Total badge */}
                          <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {qty} / {item.quantity} qty.
                          </div>
                          {/* Quantity input */}
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={qty}
                            onChange={(e) => {
                              const v = Math.max(1, Math.min(item.quantity, parseInt(e.target.value, 10) || 1));
                              setFulfillQtys((prev) => ({ ...prev, [item.id]: v }));
                            }}
                            style={{
                              width: '60px', padding: '6px 8px', textAlign: 'center',
                              border: '1px solid #D1D5DB', borderRadius: '8px',
                              fontSize: '14px', fontWeight: 600, color: '#111827',
                              background: '#FFFFFF', outline: 'none',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #F3F4F6' }} />

                {/* Footer buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowFulfillModal(false)}
                    disabled={actionLoading}
                    style={{
                      height: '40px', padding: '0 20px',
                      border: '1px solid #E6E8EC', borderRadius: '20px',
                      background: '#FFFFFF', fontSize: '15px', fontWeight: 600,
                      color: '#4B5563', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmFulfill}
                    disabled={actionLoading}
                    style={{
                      height: '40px', padding: '0 24px',
                      border: 0, borderRadius: '20px',
                      background: actionLoading ? '#9CA3AF' : 'var(--accent)',
                      color: '#FFFFFF', fontSize: '15px', fontWeight: 600,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading ? 'Fulfilling...' : 'Confirm Fulfillment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Header */}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '28px 16px 20px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button
              type="button"
              onClick={handleBackToList}
              aria-label="Back to orders"
              style={{
                width: '36px',
                height: '36px',
                boxSizing: 'border-box',
                padding: 0,
                border: '1px solid #E6E8EC',
                borderRadius: '50%',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2A3040',
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="m11 18-6-6 6-6" />
              </svg>
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px', color: '#111827' }}>
                  Order {displayOrderNo}
                </h1>
                <button
                  type="button"
                  onClick={() => handleCopy('id', displayOrderNo)}
                  aria-label="Copy order number"
                  style={{
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    border: 0,
                    borderRadius: '50%',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={copiedKey === 'id' ? '#17803F' : '#6B7280'}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {copiedKey === 'id' ? (
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    ) : (
                      <path d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                    )}
                  </svg>
                </button>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
                Placed {orderDateStr} at {orderTimeStr} {o.sales_channel?.name ? `from ${o.sales_channel.name}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                height: '28px',
                boxSizing: 'border-box',
                padding: '0 12px',
                border: `1px solid ${payInfo.tone.bd}`,
                borderRadius: '14px',
                background: payInfo.tone.bg,
                color: payInfo.tone.fg,
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: payInfo.tone.dot }} />
              {payInfo.label}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                height: '28px',
                boxSizing: 'border-box',
                padding: '0 12px',
                border: `1px solid ${fulInfo.tone.bd}`,
                borderRadius: '14px',
                background: fulInfo.tone.bg,
                color: fulInfo.tone.fg,
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: fulInfo.tone.dot }} />
              {fulInfo.label}
            </span>
          </div>
        </div>

        {/* Notice */}
        {notice && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: '0 16px 20px 24px',
              padding: '12px 18px',
              border: '1px solid #9BDDB4',
              borderRadius: '16px',
              background: '#F2FBF6',
              color: '#17803F',
              fontSize: '15px',
              fontWeight: 500,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
              <circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" />
            </svg>
            {notice}
          </div>
        )}

        {/* 2-Column Grid */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: '20px',
            padding: '0 16px 17px 24px',
            minWidth: 0,
          }}
        >
          {/* Left Column (Summary, Payments, Fulfillment) */}
          <div style={{ flex: '1 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Summary */}
            <section style={{ background: '#FFFFFF', borderRadius: '24px', paddingBottom: '8px', minWidth: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px', color: '#111827' }}>
                  Summary
                </h2>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '560px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 1fr) 130px 60px 140px',
                      alignItems: 'center',
                      height: '40px',
                      boxSizing: 'border-box',
                      padding: '0 24px',
                      background: '#F7F8FA',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#1F2937',
                    }}
                  >
                    <span>Item</span>
                    <span>Price</span>
                    <span>Qty</span>
                    <span style={{ textAlign: 'right' }}>Total</span>
                  </div>

                  {items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(200px, 1fr) 130px 60px 140px',
                        alignItems: 'center',
                        minHeight: '72px',
                        boxSizing: 'border-box',
                        padding: '8px 24px',
                        borderBottom: '1px solid #EDEFF3',
                        fontSize: '16px',
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'color-mix(in srgb, var(--accent) 12%, white)',
                            color: 'color-mix(in srgb, var(--accent) 82%, black)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 'none',
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                            <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
                          </svg>
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </span>
                          <span style={{ display: 'block', fontSize: '14px', color: '#4B5263' }}>
                            {item.variant_title || item.variant?.title || 'Default variant'}
                          </span>
                        </span>
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                        {formatMoney(item.unit_price, cur)}
                      </span>
                      <span style={{ color: '#111827' }}>{item.quantity}x</span>
                      <span style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                        {formatMoney(item.unit_price * item.quantity, cur)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Calculations */}
              <div style={{ padding: '8px 24px 16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '16px', fontWeight: 500 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '36px' }}>
                  <span style={{ color: '#4B5263' }}>Item Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{formatMoney(itemSubtotal, cur)}</span>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '36px' }}>
                    <button
                      type="button"
                      onClick={() => setOpenShip(!openShip)}
                      aria-expanded={openShip}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: 0,
                        border: 0,
                        background: 'transparent',
                        fontSize: '16px',
                        fontWeight: 500,
                        color: '#4B5263',
                        cursor: 'pointer',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transform: openShip ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                      Shipping Subtotal
                    </button>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{formatMoney(shippingTotal, cur)}</span>
                  </div>
                  {openShip && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: '32px',
                        margin: '0 0 4px 22px',
                        padding: '4px 12px',
                        borderRadius: '10px',
                        background: '#F7F8FA',
                        fontSize: '14px',
                        color: '#4B5263',
                      }}
                    >
                      <span>{shippingMethod?.name || 'Standard delivery'}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(shippingTotal, cur)}</span>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '36px' }}>
                    <button
                      type="button"
                      onClick={() => setOpenTax(!openTax)}
                      aria-expanded={openTax}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: 0,
                        border: 0,
                        background: 'transparent',
                        fontSize: '16px',
                        fontWeight: 500,
                        color: '#4B5263',
                        cursor: 'pointer',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transform: openTax ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                      Tax Total
                    </button>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{formatMoney(taxTotal, cur)}</span>
                  </div>
                  {openTax && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: '32px',
                        margin: '0 0 4px 22px',
                        padding: '4px 12px',
                        borderRadius: '10px',
                        background: '#F7F8FA',
                        fontSize: '14px',
                        color: '#4B5263',
                      }}
                    >
                      <span>Tax included</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(taxTotal, cur)}</span>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '44px',
                    marginTop: '4px',
                    borderTop: '1px solid #EDEFF3',
                    fontWeight: 600,
                    color: '#111827',
                  }}
                >
                  <span>Order Total</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(orderTotal, cur)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '36px' }}>
                  <span style={{ color: '#4B5263' }}>Paid Total</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{formatMoney(paidTotal, cur)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '36px' }}>
                  <span style={{ color: '#4B5263' }}>Outstanding amount</span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isPaid ? '#111827' : '#B45309' }}>
                    {formatMoney(outstanding, cur)}
                  </span>
                </div>
              </div>
            </section>

            {/* Payments Section */}
            <section style={{ background: '#FFFFFF', borderRadius: '24px', minWidth: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '24px 24px 16px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px', color: '#111827' }}>
                  Payments
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    height: '28px',
                    boxSizing: 'border-box',
                    padding: '0 12px',
                    border: `1px solid ${payInfo.tone.bd}`,
                    borderRadius: '14px',
                    background: payInfo.tone.bg,
                    color: payInfo.tone.fg,
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: payInfo.tone.dot }} />
                  {payInfo.label}
                </span>
              </div>

              {/* Payment Row(s) */}
              <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {allPayments.length > 0 ? (
                  allPayments.map((p, idx) => {
                    const pCaps = p.captures || [];
                    const pCapTotal = pCaps.reduce((cs: number, c: any) => cs + (Number(c.amount) || 0), 0);
                    const pCaptured = pCaps.length > 0 || Boolean(p.captured_at) || isPaid;
                    const pTone = pCaptured ? TONES.green : TONES.amber;
                    const pShortId = p.id?.startsWith('pay_') ? `#${p.id.slice(-7).toUpperCase()}` : `#${p.id?.slice(-7)}`;
                    const pDate = p.created_at ? new Date(p.created_at) : new Date(o.created_at);
                    const pDateStr = `${pDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${pDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;

                    return (
                      <div
                        key={p.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          background: '#F9FAFB',
                          border: '1px solid #F3F4F6',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                              {pShortId}
                            </span>
                            <span style={{ fontSize: '13px', color: '#6B7280' }}>
                              {pDateStr}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#4B5263' }}>
                            {p.provider_id || paymentProvider}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 'none' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              height: '24px',
                              padding: '0 10px',
                              border: `1px solid ${pTone.bd}`,
                              borderRadius: '12px',
                              background: pTone.bg,
                              color: pTone.fg,
                              fontSize: '13px',
                              fontWeight: 500,
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pTone.dot }} />
                            {pCaptured ? 'Captured' : 'Authorized'}
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                            {formatMoney(p.amount || orderTotal, p.currency_code || cur)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: '#F9FAFB',
                      border: '1px solid #F3F4F6',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                        {paymentId?.startsWith('pay_') ? `#${paymentId.slice(-7).toUpperCase()}` : paymentId}
                      </span>
                      <span style={{ fontSize: '13px', color: '#4B5263' }}>{paymentProvider}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 'none' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          height: '24px',
                          padding: '0 10px',
                          border: `1px solid ${payInfo.tone.bd}`,
                          borderRadius: '12px',
                          background: payInfo.tone.bg,
                          color: payInfo.tone.fg,
                          fontSize: '13px',
                          fontWeight: 500,
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: payInfo.tone.dot }} />
                        {payInfo.label}
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                        {formatMoney(orderTotal, cur)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {canCapture && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px 16px',
                    margin: '0 24px 20px',
                    padding: '16px 20px',
                    border: '1px solid #F7D9A3',
                    borderRadius: '16px',
                    background: '#FFFAF0',
                  }}
                >
                  <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, lineHeight: '22px', color: '#92400E' }}>
                      Payment authorized, not captured
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#B45309' }}>
                      Capture {formatMoney(orderTotal, cur)} to receive the funds for this order.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleCapturePayment}
                    style={{
                      height: '40px',
                      boxSizing: 'border-box',
                      padding: '0 22px',
                      border: 0,
                      borderRadius: '20px',
                      background: 'var(--accent)',
                      color: '#FFFFFF',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading ? 'Capturing...' : 'Capture payment'}
                  </button>
                </div>
              )}

              {/* Total paid by customer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 24px',
                  borderTop: '1px solid #F3F4F6',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: '#4B5263',
                }}
              >
                <span>Total paid by customer</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                  {formatMoney(paidTotal, cur)}
                </span>
              </div>
            </section>

            {/* Fulfillment Section */}
            <section style={{ background: '#FFFFFF', borderRadius: '24px', minWidth: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '24px 24px 16px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px', color: '#111827' }}>
                  {stage >= 1 ? 'Fulfillment #1' : 'Fulfillment'}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    height: '28px',
                    boxSizing: 'border-box',
                    padding: '0 12px',
                    border: `1px solid ${fulInfo.tone.bd}`,
                    borderRadius: '14px',
                    background: fulInfo.tone.bg,
                    color: fulInfo.tone.fg,
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: fulInfo.tone.dot }} />
                  {fulInfo.label}
                </span>
              </div>

              {stage >= 1 ? (
                <dl style={{ margin: 0, padding: '0 24px 8px', display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: '12px 16px', fontSize: '16px', fontWeight: 500 }}>
                  <dt style={{ color: '#4B5263' }}>Items</dt>
                  <dd style={{ margin: 0, color: '#111827' }}>
                    {items.map((it, idx) => (
                      <div key={idx}>
                        {it.quantity}x {it.title} ({it.variant_title || it.variant?.title || 'Default variant'})
                      </div>
                    ))}
                  </dd>
                  <dt style={{ color: '#4B5263' }}>Shipping from</dt>
                  <dd style={{ margin: 0, color: '#111827' }}>
                    Main Warehouse
                  </dd>
                  <dt style={{ color: '#4B5263' }}>Provider</dt>
                  <dd style={{ margin: 0, color: '#111827' }}>{fulfillmentProvider}</dd>
                  <dt style={{ color: '#4B5263' }}>Tracking</dt>
                  <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{trackingNumber}</dd>
                </dl>
              ) : (
                <p style={{ margin: 0, padding: '0 24px 8px', fontSize: '16px', fontWeight: 500, color: '#4B5263' }}>
                  Nothing has been fulfilled yet.{' '}
                  {items.reduce((s, it) => s + it.quantity, 0)} item(s) are waiting to be fulfilled.
                </p>
              )}

              {/* Action buttons with real Medusa workflows */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px 24px' }}>
                {stage === 0 && (
                  <button
                    type="button"
                    disabled={fulfillLoading || actionLoading}
                    onClick={handleFulfillItems}
                    style={{
                      height: '40px',
                      boxSizing: 'border-box',
                      padding: '0 22px',
                      border: 0,
                      borderRadius: '20px',
                      background: 'var(--accent)',
                      color: '#FFFFFF',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: (fulfillLoading || actionLoading) ? 'not-allowed' : 'pointer',
                      opacity: (fulfillLoading || actionLoading) ? 0.7 : 1,
                    }}
                  >
                    {fulfillLoading ? 'Loading...' : 'Fulfill items'}
                  </button>
                )}
                {stage === 1 && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleMarkShipped}
                    style={{
                      height: '40px',
                      boxSizing: 'border-box',
                      padding: '0 22px',
                      border: 0,
                      borderRadius: '20px',
                      background: 'var(--accent)',
                      color: '#FFFFFF',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading ? 'Updating...' : 'Mark as shipped'}
                  </button>
                )}
                {stage === 2 && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleMarkDelivered}
                    style={{
                      height: '40px',
                      boxSizing: 'border-box',
                      padding: '0 22px',
                      border: 0,
                      borderRadius: '20px',
                      background: 'var(--accent)',
                      color: '#FFFFFF',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading ? 'Updating...' : 'Mark as delivered'}
                  </button>
                )}
                {stage === 3 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 500, color: '#17803F' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" />
                    </svg>
                    Delivered to the customer
                  </span>
                )}
              </div>
            </section>
          </div>

          {/* Right Column (Customer profile, Activity) */}
          <div style={{ flex: '0 1 360px', minWidth: '280px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Customer Card */}
            <section style={{ background: '#FFFFFF', borderRadius: '24px', minWidth: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '24px 24px 12px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px', color: '#111827' }}>
                  Customer
                </h2>
              </div>
              <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'color-mix(in srgb, var(--accent) 14%, white)',
                      color: 'color-mix(in srgb, var(--accent) 82%, black)',
                      fontSize: '16px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                    }}
                  >
                    {initials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, lineHeight: '22px', color: '#111827' }}>{customerName}</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, lineHeight: '18px', color: '#6B7280' }}>
                      ID {o.customer?.id || 'Guest'}
                    </div>
                  </div>
                </div>

                {/* Email with copy */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>Email</div>
                    <div style={{ fontSize: '16px', fontWeight: 500, lineHeight: '22px', wordBreak: 'break-all', color: '#111827' }}>{email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('email', email)}
                    aria-label="Copy email"
                    style={{
                      width: '32px',
                      height: '32px',
                      padding: 0,
                      border: 0,
                      borderRadius: '50%',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flex: 'none',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={copiedKey === 'email' ? '#17803F' : '#6B7280'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {copiedKey === 'email' ? (
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      ) : (
                        <path d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                      )}
                    </svg>
                  </button>
                </div>

                {/* Phone with copy */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>Phone</div>
                    <div style={{ fontSize: '16px', fontWeight: 500, lineHeight: '22px', color: '#111827' }}>{phone}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy('phone', phone)}
                    aria-label="Copy phone number"
                    style={{
                      width: '32px',
                      height: '32px',
                      padding: 0,
                      border: 0,
                      borderRadius: '50%',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flex: 'none',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={copiedKey === 'phone' ? '#17803F' : '#6B7280'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {copiedKey === 'phone' ? (
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      ) : (
                        <path d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                      )}
                    </svg>
                  </button>
                </div>

                <div style={{ height: '1px', background: '#EDEFF3' }} />

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>Shipping address</div>
                  <div style={{ fontSize: '16px', fontWeight: 500, lineHeight: '22px', color: '#111827' }}>{street}</div>
                  {cityPostal && <div style={{ fontSize: '16px', fontWeight: 500, lineHeight: '22px', color: '#111827' }}>{cityPostal}</div>}
                  <div style={{ fontSize: '16px', fontWeight: 500, lineHeight: '22px', color: '#111827' }}>{country}</div>
                </div>

                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>Billing address</div>
                  <div style={{ fontSize: '16px', fontWeight: 500, lineHeight: '22px', color: '#111827' }}>
                    {o.billing_address?.address_1
                      ? [o.billing_address.address_1, o.billing_address.city, o.billing_address.country_code?.toUpperCase()].filter(Boolean).join(', ')
                      : 'Same as shipping address'}
                  </div>
                </div>
              </div>
            </section>

            {/* Real Activity Card */}
            <section style={{ background: '#FFFFFF', borderRadius: '24px', minWidth: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '24px 24px 12px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px', color: '#111827' }}>
                  Activity
                </h2>
              </div>
              <ol style={{ margin: 0, padding: '4px 24px 24px', listStyle: 'none' }}>
                {activityItems.map((a, i) => (
                  <li key={i} style={{ display: 'flex', gap: '14px' }}>
                    <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: '12px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          marginTop: '5px',
                          boxSizing: 'border-box',
                          borderRadius: '50%',
                          border: `3px solid ${i === 0 ? 'var(--accent)' : '#C9CDD8'}`,
                          background: '#FFFFFF',
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          width: '2px',
                          minHeight: '16px',
                          background: i === activityItems.length - 1 ? 'transparent' : '#E6E8EC',
                        }}
                      />
                    </span>
                    <span style={{ paddingBottom: '18px', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, lineHeight: '22px', color: '#111827' }}>
                        {a.title}
                      </span>
                      <span style={{ display: 'block', fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#6B7280' }}>
                        {a.when}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, listTotal);
  const footerText = search.trim()
    ? `Showing ${filteredOrders.length} of ${orders.length} entries`
    : listTotal > 0
    ? `Showing ${start} to ${end} of ${listTotal} entries`
    : 'No orders';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, fontFamily: 'Urbanist, sans-serif' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '28px 16px 20px 24px',
          minHeight: '44px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '30px', color: '#111827' }}>
          Orders
        </h1>
      </div>

      {/* Main Table Card */}
      <section
        style={{
          margin: '0 16px 17px 24px',
          background: '#FFFFFF',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Card Header: Search, Filter, Sort by */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '24px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '44px', color: '#111827' }}>
            All Orders
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                boxSizing: 'border-box',
                width: '264px',
                maxWidth: '100%',
                height: '44px',
                padding: '0 17px',
                border: '1px solid #E6E8EC',
                borderRadius: '22px',
                background: '#FFFFFF',
              }}
            >
              <SearchIcon style={{ flex: 'none', width: '18px', height: '18px', stroke: '#2A3040' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search orders by number, customer or email"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  color: '#111827',
                }}
              />
            </label>

            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                boxSizing: 'border-box',
                height: '44px',
                padding: '0 18px 0 17px',
                border: '1px solid #E6E8EC',
                borderRadius: '22px',
                background: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 500,
                color: '#4B5263',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
              Filter
            </button>

            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                boxSizing: 'border-box',
                width: '130px',
                height: '44px',
                padding: '0 18px 0 17px',
                border: '1px solid #E6E8EC',
                borderRadius: '22px',
                background: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 500,
                color: '#4B5263',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 8 4-4 4 4" /><path d="M7 4v16" />
                <path d="M11 12h4" /><path d="M11 16h7" /><path d="M11 20h10" />
              </svg>
              Sort by
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '1040px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 130px minmax(150px, 1fr) minmax(170px, 1fr) 140px 150px 190px 36px',
                alignItems: 'center',
                height: '40px',
                boxSizing: 'border-box',
                padding: '0 24px',
                background: '#F7F8FA',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1F2937',
              }}
            >
              <span>Order</span>
              <span>Date</span>
              <span>Customer</span>
              <span>Sales Channel</span>
              <span>Payment</span>
              <span>Fulfillment</span>
              <span style={{ textAlign: 'right', paddingRight: '12px' }}>Order Total</span>
              <span />
            </div>

            <div>
              {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#8A90A0' }}>Loading orders...</div>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const stage = getFulfillmentStage(order);
                  const fulInfo = getFulfillmentBadgeInfo(stage);
                  const payInfo = getPaymentBadgeInfo(order.payment_status);

                  const orderNo = `#${order.display_id || order.id.slice(-6)}`;
                  const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const customerName = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || order.customer?.email || 'Guest Customer';
                  const salesChannel = order.sales_channel?.name || 'Default Sales Channel';
                  const formattedTotal = formatMoney(order.total, order.currency_code);

                  return (
                    <div
                      key={order.id}
                      onClick={() => handleOpenDetail(order)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px 130px minmax(150px, 1fr) minmax(170px, 1fr) 140px 150px 190px 36px',
                        alignItems: 'center',
                        height: '64px',
                        boxSizing: 'border-box',
                        padding: '0 24px',
                        borderBottom: '1px solid #EDEFF3',
                        fontSize: '16px',
                        fontWeight: 500,
                        color: '#111827',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(order);
                          }}
                          aria-label={`Open order ${orderNo}`}
                          style={{
                            padding: 0,
                            border: 0,
                            background: 'transparent',
                            fontFamily: 'inherit',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#111827',
                            cursor: 'pointer',
                          }}
                        >
                          {orderNo}
                        </button>
                      </span>

                      <span style={{ color: '#4B5263' }}>{orderDate}</span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>
                        {customerName}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px', color: '#4B5263' }}>
                        {salesChannel}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: payInfo.tone.dot }} />
                        {payInfo.label}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: fulInfo.tone.dot }} />
                        {fulInfo.label}
                      </span>
                      <span style={{ textAlign: 'right', paddingRight: '12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formattedTotal}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <TunisiaFlag />
                      </span>
                    </div>
                  );
                })
              ) : (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '96px',
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#4B5263',
                  }}
                >
                  No orders match your search.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '32px 24px 24px 24px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#3F4654' }}>
            {footerText}
          </span>
          <nav aria-label="Pagination" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                height: '40px',
                boxSizing: 'border-box',
                padding: '0 16px',
                border: '1px solid #E3E6EB',
                borderRadius: '10px',
                background: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 500,
                color: '#111827',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.4 : 1,
              }}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => setPage(p)}
                style={{
                  width: '40px',
                  height: '40px',
                  boxSizing: 'border-box',
                  padding: 0,
                  border: `1px solid ${p === page ? 'var(--accent)' : '#E3E6EB'}`,
                  borderRadius: '10px',
                  background: p === page ? 'var(--accent)' : '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: p === page ? '#FFFFFF' : '#111827',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                height: '40px',
                boxSizing: 'border-box',
                padding: '0 16px',
                border: '1px solid #E3E6EB',
                borderRadius: '10px',
                background: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 500,
                color: '#111827',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.4 : 1,
              }}
            >
              Next
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}
