// Turns text copied from an AI assistant (or a web page, or a document) into the
// small Markdown the support pages understand, so headings, bold text, lists and
// links keep their look when a merchant pastes them. Runs in the browser: it
// reads the pasted HTML with the browser's own parser and never inserts it into
// the page.

const SKIP_TAGS = new Set([
  'script',
  'style',
  'head',
  'meta',
  'title',
  'link',
  'noscript',
  'template',
  'svg',
  'button',
  'img',
  'iframe',
  'object',
  'canvas',
]);

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'blockquote',
  'figure',
  'figcaption',
  'details',
  'summary',
  'form',
  'address',
  'center',
  'fieldset',
  'body',
  'html',
]);

const MAX_LIST_LEVEL = 3;

function tagOf(node: Node): string {
  return node.nodeType === 1 ? (node as Element).tagName.toLowerCase() : '';
}

// Only these addresses are kept as links, like the server does.
export function isLinkable(href: string): boolean {
  const value = href.trim();
  if (value === '' || /\s/.test(value)) return false;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.username === '' && url.password === '' && url.hostname !== '';
    } catch {
      return false;
    }
  }
  return /^mailto:[^\s@]+@[^\s@]+$/i.test(value) || /^tel:\+?[0-9][0-9().-]*$/i.test(value);
}

function weightOf(el: Element): number | null {
  const raw = (el as HTMLElement).style?.fontWeight;
  if (!raw) return null;
  if (raw === 'bold' || raw === 'bolder') return 700;
  if (raw === 'normal' || raw === 'lighter') return 400;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function isBold(el: Element): boolean {
  const weight = weightOf(el);
  const tag = tagOf(el);
  if (tag === 'strong' || tag === 'b') return weight === null || weight >= 600;
  return weight !== null && weight >= 600;
}

function isItalic(el: Element): boolean {
  const style = (el as HTMLElement).style?.fontStyle;
  const tag = tagOf(el);
  if (tag === 'em' || tag === 'i') return style !== 'normal';
  return style === 'italic' || style === 'oblique';
}

// A character that would be read as formatting is escaped
function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_');
}

// A line that would start a heading, list or rule when it is plain text
function escapeLineStart(line: string): string {
  if (/^#{1,6}\s/.test(line)) return '\\' + line;
  if (/^[-+]\s/.test(line)) return '\\' + line;
  if (/^\d{1,9}[.)]\s/.test(line)) return line.replace(/^(\d{1,9})([.)])/, '$1\\$2');
  if (/^[-_]([ \t]*[-_]){2,}$/.test(line) && /^(-+|_+)$/.test(line.replace(/\s/g, ''))) return '\\' + line;
  return line;
}

function tidyLines(text: string, escapeFirst: boolean): string[] {
  const lines = text.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim());
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.map((line, index) => (index === 0 && !escapeFirst ? line : escapeLineStart(line)));
}

function wrap(inner: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
  if (match[2] === '') return inner;
  return match[1] + marker + match[2] + marker + match[3];
}

function inlineChildren(el: Node): string {
  let out = '';
  el.childNodes.forEach((child) => {
    out += inlineOf(child);
  });
  return out;
}

function inlineOf(node: Node): string {
  if (node.nodeType === 3) {
    return escapeText((node.textContent ?? '').replace(/\s+/g, ' '));
  }
  if (node.nodeType !== 1) return '';

  const el = node as Element;
  const tag = tagOf(el);
  if (SKIP_TAGS.has(tag)) return '';
  if (tag === 'br') return '\n';

  let inner = inlineChildren(el);

  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    const label = inner.replace(/[[\]]/g, '').trim();
    return label !== '' && isLinkable(href) ? `[${label}](${href.trim()})` : inner;
  }

  // A block inside inline text (a paragraph inside a list item) starts a new line
  if (BLOCK_TAGS.has(tag)) {
    return inner.trim() === '' ? '' : `\n${inner}\n`;
  }

  if (isItalic(el)) inner = wrap(inner, '*');
  if (isBold(el)) inner = wrap(inner, '**');
  return inner;
}

function listToLines(list: Element, level: number): string[] {
  const ordered = tagOf(list) === 'ol';
  let number = parseInt(list.getAttribute('start') ?? '1', 10);
  if (Number.isNaN(number) || number < 1) number = 1;
  const pad = '  '.repeat(Math.min(level, MAX_LIST_LEVEL));
  const lines: string[] = [];

  Array.from(list.children).forEach((item) => {
    if (tagOf(item) !== 'li') return;

    let run = '';
    const nested: string[] = [];
    item.childNodes.forEach((child) => {
      const tag = tagOf(child);
      if (tag === 'ul' || tag === 'ol') {
        nested.push(...listToLines(child as Element, level + 1));
      } else {
        run += inlineOf(child);
      }
    });

    const text = tidyLines(run, false);
    const marker = ordered ? `${number}. ` : '- ';
    number++;
    lines.push(`${pad}${marker}${text[0] ?? ''}`);
    text.slice(1).forEach((extra) => lines.push(`${pad}  ${extra}`));
    lines.push(...nested);
  });

  return lines;
}

function tableToLines(table: Element): string {
  const rows: string[] = [];
  table.querySelectorAll('tr').forEach((row) => {
    const cells = Array.from(row.children)
      .filter((c) => ['td', 'th'].includes(tagOf(c)))
      .map((c) => inlineChildren(c).replace(/\s+/g, ' ').trim())
      .filter((c) => c !== '');
    if (cells.length > 0) rows.push(cells.join(' | '));
  });
  return rows.map((r) => escapeLineStart(r)).join('\n');
}

function blocksOf(parent: Node): string[] {
  const out: string[] = [];
  let run = '';

  const flush = () => {
    const lines = tidyLines(run, true);
    if (lines.length > 0) out.push(lines.join('\n'));
    run = '';
  };

  parent.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      run += inlineOf(child);
      return;
    }
    if (child.nodeType !== 1) return;

    const el = child as Element;
    const tag = tagOf(el);
    if (SKIP_TAGS.has(tag)) return;

    if (/^h[1-6]$/.test(tag)) {
      flush();
      const text = tidyLines(inlineChildren(el), false).join(' ');
      if (text !== '') out.push(`${'#'.repeat(parseInt(tag[1], 10))} ${text}`);
    } else if (tag === 'ul' || tag === 'ol') {
      flush();
      const lines = listToLines(el, 0);
      if (lines.length > 0) out.push(lines.join('\n'));
    } else if (tag === 'hr') {
      flush();
      out.push('---');
    } else if (tag === 'table') {
      flush();
      const text = tableToLines(el);
      if (text !== '') out.push(text);
    } else if (tag === 'pre') {
      flush();
      const lines = tidyLines(escapeText(el.textContent ?? ''), true);
      if (lines.length > 0) out.push(lines.join('\n'));
    } else if (tag === 'p') {
      flush();
      const lines = tidyLines(inlineChildren(el), true);
      if (lines.length > 0) out.push(lines.join('\n'));
    } else if (BLOCK_TAGS.has(tag)) {
      flush();
      out.push(...blocksOf(el));
    } else {
      run += inlineOf(el);
    }
  });

  flush();
  return out;
}

// Is there anything in the pasted HTML that plain text would lose?
function hasFormatting(doc: Document): boolean {
  if (doc.body.querySelector('h1,h2,h3,h4,h5,h6,ul,ol,li,hr,table')) return true;
  if (doc.body.querySelector('a[href]')) return true;
  const styled = Array.from(doc.body.querySelectorAll('*')).some(
    (el) => !SKIP_TAGS.has(tagOf(el)) && (isBold(el) || isItalic(el)) && (el.textContent ?? '').trim() !== ''
  );
  return styled;
}

// The Markdown for pasted HTML, or null when the paste is plain text (the browser
// then pastes it as it is).
export function htmlToMarkdown(html: string): string | null {
  if (typeof DOMParser === 'undefined' || html.trim() === '') return null;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }
  if (!hasFormatting(doc)) return null;

  const text = blocksOf(doc.body).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return text === '' ? null : text;
}

// `value` with the part from `start` to `end` replaced by `insert`, and where the
// cursor goes after it.
export function replaceRange(
  value: string,
  start: number,
  end: number,
  insert: string
): { value: string; caret: number } {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  return { value: value.slice(0, from) + insert + value.slice(to), caret: from + insert.length };
}
