'use client';

import React, { useState } from 'react';
import { inputStyle, smallButton, dangerSmallButton } from '@/components/settings/styles';
import {
  MAX_OPTIONS,
  MAX_VALUES,
  MAX_VARIANTS,
  SIZE_PRESETS,
  addValues,
  applyToAll,
  newOption,
  optionsChanged,
  removeValue,
  removedVariantCount,
  renameOption,
  rowTitle,
  splitValues,
  syncRows,
  type OptionDraft,
  type VariantsState,
} from '@/lib/variants';

type Props = {
  value: VariantsState;
  onChange: (next: VariantsState) => void;
  // The options as they were when the product was loaded (off when it is new)
  original: VariantsState;
  // Price and stock the merchant had typed before turning options on
  startPrice: string;
  startStock: string;
  currency?: string;
};

const cardStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  padding: '24px',
  background: '#FFFFFF',
  borderRadius: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const cellInput: React.CSSProperties = {
  height: '36px',
  boxSizing: 'border-box',
  width: '100%',
  padding: '0 12px',
  border: '1px solid #E6E8EC',
  borderRadius: '18px',
  background: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: '16px',
  color: '#111827',
  outline: 'none',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  height: '32px',
  boxSizing: 'border-box',
  padding: '0 6px 0 12px',
  borderRadius: '16px',
  background: '#EEF2FF',
  color: '#3730A3',
  fontSize: '14px',
  fontWeight: 500,
};

const notice = (tone: 'warn' | 'info'): React.CSSProperties => ({
  margin: 0,
  padding: '12px 16px',
  borderRadius: '16px',
  fontSize: '14px',
  lineHeight: '20px',
  background: tone === 'warn' ? '#FFF7E6' : '#F3F4F6',
  color: tone === 'warn' ? '#92400E' : '#374151',
});

export default function VariantsEditor({ value, onChange, original, startPrice, startStock, currency = 'TND' }: Props) {
  // What is typed in each option's "add a value" box, by option key
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  const defaults = () => {
    const first = value.rows.find((r) => r.enabled) || value.rows[0];
    return { price: first ? first.price : startPrice, stock: first ? first.stock : startStock || '0' };
  };

  // Every change to the options goes through here so the table follows
  const setOptions = (options: OptionDraft[], base: VariantsState = value) => {
    onChange({ ...base, options, rows: syncRows(options, base.rows, defaults()) });
  };

  const toggle = (on: boolean) => {
    if (on) {
      // Options that were switched off a moment ago, or the product's own, come back as they were
      if (value.options.length > 0) onChange({ ...value, enabled: true });
      else onChange(original.enabled ? { ...original, enabled: true } : { enabled: true, options: [], rows: [] });
    } else {
      onChange({ ...value, enabled: false });
    }
  };

  const addOption = (title: string, values: string[] = []) => {
    if (value.options.length >= MAX_OPTIONS) return;
    const option = addValues(newOption(title), values);
    setOptions([...value.options, option]);
  };

  const commit = (option: OptionDraft, text: string) => {
    const parts = splitValues(text);
    setTyped((t) => ({ ...t, [option.key]: '' }));
    if (parts.length === 0) return;
    setOptions(value.options.map((o) => (o.key === option.key ? addValues(o, parts) : o)));
  };

  const hasOption = (name: string) => value.options.some((o) => o.title.trim().toLowerCase() === name);

  const sold = value.rows.filter((r) => r.enabled).length;
  const removed = removedVariantCount(original, value);
  const rebuilt = original.enabled && optionsChanged(original, value);
  const turnedOff = original.enabled && !value.enabled;

  const setRow = (key: string, patch: Partial<VariantsState['rows'][number]>) =>
    onChange({ ...value, rows: value.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  return (
    <section style={cardStyle} aria-label="Options and variants">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px 16px' }}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, lineHeight: '28px' }}>Options</h2>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: '#4B5263' }}>
            Sizes, colors, storage… Each combination gets its own price and stock.
          </p>
        </div>
        <label
          style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', flex: '0 0 auto' }}
        >
          <input
            id="p-options-switch"
            type="checkbox"
            role="switch"
            checked={value.enabled}
            onChange={(e) => toggle(e.target.checked)}
            style={{ width: '20px', height: '20px', accentColor: '#4F46E5' }}
          />
          This product has options
        </label>
      </div>

      {turnedOff && (
        <p style={notice('warn')} role="status">
          The product will go back to a single price and stock. Its {original.rows.filter((r) => r.enabled).length}{' '}
          variants are deleted when you save. Orders already placed keep their details.
        </p>
      )}

      {value.enabled && (
        <>
          {value.options.map((option) => (
            <div
              key={option.key}
              data-testid="option-card"
              style={{ border: '1px solid #E6E8EC', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 500, flex: 1, minWidth: 0 }}>
                  Option name
                  <input
                    aria-label="Option name"
                    value={option.title}
                    maxLength={40}
                    placeholder="Size, Color, Storage…"
                    onChange={(e) => onChange(renameAndSync(value, option.key, e.target.value, defaults))}
                    style={inputStyle}
                  />
                </label>
                <button
                  type="button"
                  style={dangerSmallButton}
                  onClick={() => setOptions(value.options.filter((o) => o.key !== option.key))}
                >
                  Remove
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {option.values.map((v) => (
                  <span key={v} style={chipStyle}>
                    {v}
                    <button
                      type="button"
                      aria-label={`Remove ${v}`}
                      onClick={() =>
                        setOptions(value.options.map((o) => (o.key === option.key ? removeValue(o, v) : o)))
                      }
                      style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '18px', lineHeight: 1, width: '24px', height: '24px', borderRadius: '12px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <input
                aria-label={`Add a value to ${option.title || 'this option'}`}
                value={typed[option.key] ?? ''}
                disabled={option.values.length >= MAX_VALUES}
                placeholder={
                  option.values.length >= MAX_VALUES
                    ? `At most ${MAX_VALUES} values`
                    : 'Type a value, then press Enter (or paste S, M, L)'
                }
                onChange={(e) => {
                  const text = e.target.value;
                  // A comma closes the value
                  if (text.includes(',') || text.includes(';')) commit(option, text);
                  else setTyped((t) => ({ ...t, [option.key]: text }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Enter must not send the whole product form
                    e.preventDefault();
                    commit(option, typed[option.key] ?? '');
                  }
                }}
                onBlur={() => commit(option, typed[option.key] ?? '')}
                style={inputStyle}
              />

              {option.title.trim().toLowerCase() === 'size' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    type="button"
                    style={smallButton}
                    onClick={() => setOptions(value.options.map((o) => (o.key === option.key ? addValues(o, SIZE_PRESETS.clothes) : o)))}
                  >
                    + Clothes sizes S–XXL
                  </button>
                  <button
                    type="button"
                    style={smallButton}
                    onClick={() => setOptions(value.options.map((o) => (o.key === option.key ? addValues(o, SIZE_PRESETS.shoes) : o)))}
                  >
                    + Shoe sizes 36–46
                  </button>
                </div>
              )}
            </div>
          ))}

          {value.options.length < MAX_OPTIONS && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {!hasOption('size') && (
                <button type="button" style={smallButton} onClick={() => addOption('Size')}>
                  + Size
                </button>
              )}
              {!hasOption('color') && (
                <button type="button" style={smallButton} onClick={() => addOption('Color')}>
                  + Color
                </button>
              )}
              <button type="button" style={smallButton} onClick={() => addOption('')}>
                + Other option
              </button>
            </div>
          )}

          {value.rows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                  Combinations <span style={{ color: '#4B5263', fontWeight: 500 }}>({sold} on sale)</span>
                </h3>
                {sold > MAX_VARIANTS && <span style={{ color: '#B42318', fontSize: '14px' }}>At most {MAX_VARIANTS}</span>}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <input
                  aria-label="Price for all combinations"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Price for all (${currency})`}
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  style={{ ...cellInput, width: '170px' }}
                />
                <button
                  type="button"
                  style={smallButton}
                  disabled={bulkPrice.trim() === ''}
                  onClick={() => onChange({ ...value, rows: applyToAll(value.rows, 'price', bulkPrice) })}
                >
                  Apply
                </button>
                <input
                  aria-label="Stock for all combinations"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Stock for all"
                  value={bulkStock}
                  onChange={(e) => setBulkStock(e.target.value)}
                  style={{ ...cellInput, width: '140px' }}
                />
                <button
                  type="button"
                  style={smallButton}
                  disabled={bulkStock.trim() === ''}
                  onClick={() => onChange({ ...value, rows: applyToAll(value.rows, 'stock', bulkStock) })}
                >
                  Apply
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {value.rows.map((row) => {
                  const name = rowTitle(value.options, row);
                  return (
                    <div
                      key={row.key}
                      data-testid="variant-row"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '10px 12px',
                        padding: '10px 14px',
                        borderRadius: '16px',
                        background: row.enabled ? '#F9FAFB' : '#F3F4F6',
                        opacity: row.enabled ? 1 : 0.7,
                      }}
                    >
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flex: '1 1 140px', minWidth: 0, fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          aria-label={`Sell ${name}`}
                          checked={row.enabled}
                          onChange={(e) => setRow(row.key, { enabled: e.target.checked })}
                          style={{ width: '18px', height: '18px', accentColor: '#4F46E5', flex: '0 0 auto' }}
                        />
                        <span style={{ overflowWrap: 'anywhere' }}>{name}</span>
                      </label>
                      <div style={{ flex: '1 1 110px', maxWidth: '160px', minWidth: '96px' }}>
                        <input
                          aria-label={`Price of ${name}`}
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!row.enabled}
                          placeholder={`Price (${currency})`}
                          value={row.price}
                          onChange={(e) => setRow(row.key, { price: e.target.value })}
                          style={cellInput}
                        />
                      </div>
                      <div style={{ flex: '1 1 80px', maxWidth: '120px', minWidth: '72px' }}>
                        <input
                          aria-label={`Stock of ${name}`}
                          type="number"
                          min="0"
                          step="1"
                          disabled={!row.enabled}
                          placeholder="Stock"
                          value={row.stock}
                          onChange={(e) => setRow(row.key, { stock: e.target.value })}
                          style={cellInput}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rebuilt && (
            <p style={notice('warn')} role="status">
              You changed which options the product has. When you save, all its existing variants are replaced by the
              ones above, with the prices and stock shown here. Orders already placed keep their details.
            </p>
          )}
          {!rebuilt && removed > 0 && (
            <p style={notice('info')} role="status">
              {removed} existing {removed === 1 ? 'variant is' : 'variants are'} deleted when you save. Orders already
              placed keep their details; a customer who has one in their cart will have to choose again.
            </p>
          )}
        </>
      )}
    </section>
  );
}

// Renames an option and keeps the table in step
function renameAndSync(
  state: VariantsState,
  key: string,
  title: string,
  defaults: () => { price: string; stock: string }
): VariantsState {
  const renamed = renameOption(state, key, title);
  return { ...renamed, rows: syncRows(renamed.options, renamed.rows, defaults()) };
}
