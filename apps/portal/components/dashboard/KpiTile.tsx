import React from 'react';
import { KpiData } from '@/lib/dashboard-data';
import Sparkline from './Sparkline';
import {
  CircleDollarSignIcon,
  ShoppingCartIcon,
  TruckIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@/components/icons';

interface KpiTileProps {
  data: KpiData;
}

export default function KpiTile({ data }: KpiTileProps) {
  const renderIcon = () => {
    switch (data.iconName) {
      case 'dollar':
        return <CircleDollarSignIcon />;
      case 'cart':
        return <ShoppingCartIcon />;
      case 'truck':
        return <TruckIcon />;
    }
  };

  return (
    <div
      style={{
        flex: '1 1 280px',
        minWidth: 0,
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: '#4B5263',
          }}
        >
          {data.title}
        </span>
        <span
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid #E6E8EC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2A3040',
            flex: 'none',
          }}
        >
          {renderIcon()}
        </span>
      </div>

      {/* Bottom row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '32px',
              fontWeight: 600,
              lineHeight: '40px',
              color: '#111827',
              fontVariantNumeric: 'proportional-nums',
            }}
          >
            {data.value}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '24px',
                padding: '0 8px',
                gap: '4px',
                borderRadius: '12px',
                background: data.isUp ? '#F2FBF6' : '#FFF5F5',
                border: data.isUp ? '1px solid #9BDDB4' : '1px solid #FCA5A5',
                color: data.isUp ? '#17803F' : '#DC2626',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {data.isUp ? <ArrowUpIcon /> : <ArrowDownIcon />}
              {data.delta}
            </span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#4B5263',
                whiteSpace: 'nowrap',
              }}
            >
              {data.deltaCaption}
            </span>
          </div>
        </div>

        <div style={{ paddingBottom: '4px' }}>
          <Sparkline
            series={data.sparklineSeries}
            ariaLabel={data.sparklineAriaLabel}
          />
        </div>
      </div>
    </div>
  );
}
