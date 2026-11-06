// The options and variants of a product, as the merchant edits them. No React
// here, so the rules can be tested on their own. They mirror the backend's rules
// (the server checks everything again), so a problem shows before saving.

import type { MerchantProduct, ProductOptionInfo, VariantsInput } from './medusa';

export const MAX_OPTIONS = 3;
export const MAX_VALUES = 20;
export const MAX_VARIANTS = 100;
export const MAX_NAME = 40;

// Medusa gives a product without options this one, with one value
const DEFAULT_OPTION = 'Default Option';

export type OptionDraft = { key: string; title: string; values: string[] };

export type RowDraft = {
  key: string;
  // Set when the variant exists already
  id?: string;
  // The value of every option, by option title
  options: Record<string, string>;
  price: string;
  stock: string;
  // Off = this combination is not sold
  enabled: boolean;
};

export type VariantsState = {
  // Off = a single price and stock, as before
  enabled: boolean;
  options: OptionDraft[];
  rows: RowDraft[];
};

let counter = 0;
export function newKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function emptyVariants(): VariantsState {
  return { enabled: false, options: [], rows: [] };
}

export function newOption(title = ''): OptionDraft {
  return { key: newKey('option'), title, values: [] };
}

// A product has real options when it has any option besides Medusa's placeholder
export function hasRealOptions(product: Pick<MerchantProduct, 'options'> | null | undefined): boolean {
  const options = product?.options || [];
  return options.some((o) => o.title !== DEFAULT_OPTION);
}

// The title of an option by its id, from the product
function titleOf(options: ProductOptionInfo[], optionId: string | undefined): string | undefined {
  return options.find((o) => o.id === optionId)?.title;
}

// What the editor starts with for a product that is being edited
export function variantsFromProduct(product: MerchantProduct | null | undefined): VariantsState {
  if (!product || !hasRealOptions(product)) return emptyVariants();
  const productOptions = (product.options || []).filter((o) => o.title !== DEFAULT_OPTION);

  const options: OptionDraft[] = productOptions.map((o) => ({
    key: newKey('option'),
    title: o.title,
    values: (o.values || []).map((v) => v.value),
  }));

  const rows: RowDraft[] = (product.variants || []).map((variant) => {
    const chosen: Record<string, string> = {};
    for (const entry of variant.options || []) {
      const title = titleOf(productOptions, entry.option_id);
      if (title) chosen[title] = entry.value;
    }
    const price = variant.prices?.[0]?.amount;
    return {
      key: newKey('row'),
      id: variant.id,
      options: chosen,
      price: price !== undefined ? String(price) : '',
      stock: variant.inventory_quantity !== undefined ? String(variant.inventory_quantity) : '0',
      enabled: true,
    };
  });

  // Values a variant does not use are still listed. Combinations that were removed
  // come back as switched off rows, so the merchant can turn them on again.
  const state = { enabled: true, options, rows };
  return { ...state, rows: syncRows(options, rows, { price: rows[0]?.price ?? '', stock: '0' }, true) };
}

// Every combination of the values, in the order of the options and their values
export function combinations(options: OptionDraft[]): Array<Record<string, string>> {
  const usable = options.filter((o) => o.title.trim() !== '' && o.values.length > 0);
  if (usable.length === 0) return [];
  let result: Array<Record<string, string>> = [{}];
  for (const option of usable) {
    const next: Array<Record<string, string>> = [];
    for (const partial of result) {
      for (const value of option.values) {
        next.push({ ...partial, [option.title.trim()]: value });
      }
    }
    result = next;
  }
  return result;
}

const comboKey = (options: OptionDraft[], chosen: Record<string, string>) =>
  options
    .filter((o) => o.title.trim() !== '' && o.values.length > 0)
    .map((o) => (chosen[o.title.trim()] ?? '').toLowerCase())
    .join('\u0000');

// The rows for the current options. A combination that was there before keeps its
// price, stock and on/off switch; a new one starts with the default price and stock.
// `offIfNew` is for the first load, where combinations the product does not have are off.
export function syncRows(
  options: OptionDraft[],
  previous: RowDraft[],
  defaults: { price: string; stock: string },
  offIfNew = false
): RowDraft[] {
  const titles = options.filter((o) => o.title.trim() !== '' && o.values.length > 0);
  const byKey = new Map<string, RowDraft>();
  for (const row of previous) {
    // A row only counts if it has a value for every option that is in use
    if (titles.every((o) => row.options[o.title.trim()] !== undefined)) {
      byKey.set(comboKey(options, row.options), row);
    }
  }
  return combinations(options).map((chosen) => {
    const old = byKey.get(comboKey(options, chosen));
    if (old) return { ...old, options: chosen };
    return {
      key: newKey('row'),
      options: chosen,
      price: defaults.price,
      stock: defaults.stock,
      enabled: !offIfNew,
    };
  });
}

// Gives an option a new name; its combinations follow, so their prices stay
export function renameOption(state: VariantsState, key: string, title: string): VariantsState {
  const target = state.options.find((o) => o.key === key);
  if (!target) return state;
  const from = target.title.trim();
  const to = title.trim();
  const options = state.options.map((o) => (o.key === key ? { ...o, title } : o));
  if (from === '' || from === to) return { ...state, options };
  const rows = state.rows.map((row) => {
    if (row.options[from] === undefined) return row;
    const { [from]: value, ...rest } = row.options;
    return { ...row, options: { ...rest, [to]: value } };
  });
  return { ...state, options, rows };
}

// How many variants that exist now are gone from what is about to be saved
export function removedVariantCount(original: VariantsState, current: VariantsState): number {
  if (!original.enabled) return 0;
  const kept = new Set(
    current.enabled ? current.rows.filter((r) => r.enabled && r.id).map((r) => r.id as string) : []
  );
  return original.rows.filter((r) => r.enabled && r.id && !kept.has(r.id)).length;
}

export function rowTitle(options: OptionDraft[], row: RowDraft): string {
  return options
    .filter((o) => o.title.trim() !== '' && o.values.length > 0)
    .map((o) => row.options[o.title.trim()])
    .join(' / ');
}

// Adds a value to an option: empty, repeated (any capitals) and too many are left out
export function addValue(option: OptionDraft, raw: string): OptionDraft {
  const value = raw.trim().slice(0, MAX_NAME);
  if (value === '' || option.values.length >= MAX_VALUES) return option;
  if (option.values.some((v) => same(v, value))) return option;
  return { ...option, values: [...option.values, value] };
}

export function addValues(option: OptionDraft, raws: string[]): OptionDraft {
  return raws.reduce((current, raw) => addValue(current, raw), option);
}

export function removeValue(option: OptionDraft, value: string): OptionDraft {
  return { ...option, values: option.values.filter((v) => v !== value) };
}

// Split what was typed or pasted: "S, M, L" or one value per line
export function splitValues(text: string): string[] {
  return text
    .split(/[,\n;]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export const SIZE_PRESETS = {
  clothes: ['S', 'M', 'L', 'XL', 'XXL'],
  shoes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
};

// The same price or stock on every row that is on sale
export function applyToAll(rows: RowDraft[], field: 'price' | 'stock', value: string): RowDraft[] {
  return rows.map((row) => (row.enabled ? { ...row, [field]: value } : row));
}

const isMoney = (text: string) => text.trim() !== '' && Number.isFinite(Number(text)) && Number(text) >= 0;
const isWhole = (text: string) => text.trim() !== '' && Number.isInteger(Number(text)) && Number(text) >= 0;

// The first thing wrong, in words the merchant understands, or null
export function validateVariants(state: VariantsState): string | null {
  if (!state.enabled) return null;
  if (state.options.length === 0) return 'Add an option such as Size or Color, or switch options off.';
  if (state.options.length > MAX_OPTIONS) return `A product can have at most ${MAX_OPTIONS} options.`;

  const seen: string[] = [];
  for (const option of state.options) {
    const title = option.title.trim();
    if (title === '') return 'Give every option a name, for example Size.';
    if (title.length > MAX_NAME) return `The option name "${title}" is too long (at most ${MAX_NAME} characters).`;
    if (seen.some((t) => same(t, title))) return `The option "${title}" is listed twice.`;
    seen.push(title);
    if (option.values.length === 0) return `Add at least one value to ${title}, for example ${title.toLowerCase() === 'color' ? 'Black' : 'M'}.`;
    if (option.values.length > MAX_VALUES) return `${title} can have at most ${MAX_VALUES} values.`;
  }

  const sold = state.rows.filter((r) => r.enabled);
  if (sold.length === 0) return 'Keep at least one combination on sale.';
  if (sold.length > MAX_VARIANTS) return `A product can have at most ${MAX_VARIANTS} variants. Switch some combinations off.`;

  for (const row of sold) {
    const name = rowTitle(state.options, row);
    if (!isMoney(row.price)) return `${name}: enter a price (0 or more).`;
    if (!isWhole(row.stock)) return `${name}: stock must be a whole number (0 or more).`;
  }
  return null;
}

// What is sent to the server for a product with options
export function variantsPayload(state: VariantsState): VariantsInput {
  return {
    options: state.options.map((o) => ({ title: o.title.trim(), values: o.values })),
    variants: state.rows
      .filter((r) => r.enabled)
      .map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        options: r.options,
        price: Number(r.price),
        inventory_quantity: Number(r.stock),
      })),
  };
}

// What is sent when a product that had options goes back to a single price and
// stock: one variant with the placeholder option every product without options has
export function singleVariantPayload(price: number, stock: number): VariantsInput {
  return {
    options: [{ title: DEFAULT_OPTION, values: ['Default'] }],
    variants: [{ options: { [DEFAULT_OPTION]: 'Default' }, price, inventory_quantity: stock }],
  };
}

// True when the options (not only the values) of a product are not the same as when
// it was loaded: then the server rebuilds every variant, and the merchant is told
export function optionsChanged(before: VariantsState, after: VariantsState): boolean {
  if (before.enabled !== after.enabled) return before.enabled || after.enabled;
  if (!after.enabled) return false;
  const a = before.options.map((o) => o.title.trim().toLowerCase()).sort();
  const b = after.options.map((o) => o.title.trim().toLowerCase()).sort();
  return a.length !== b.length || a.some((title, i) => title !== b[i]);
}

// How the list shows a product with several variants
export function summarizeVariants(
  variants: NonNullable<MerchantProduct['variants']>
): { price: string; stock: string } {
  const prices = variants
    .map((v) => v.prices?.[0])
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  const stock = variants.reduce((sum, v) => sum + Number(v.inventory_quantity ?? 0), 0);

  if (prices.length === 0) return { price: 'N/A', stock: String(stock) };
  const currency = prices[0].currency_code.toUpperCase();
  const amounts = prices.map((p) => Number(p.amount));
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const price =
    low === high ? `${low.toFixed(2)} ${currency}` : `${low.toFixed(2)} - ${high.toFixed(2)} ${currency}`;
  return { price, stock: String(stock) };
}
