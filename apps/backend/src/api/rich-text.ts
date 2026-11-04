// Turns the text of a support page into blocks a storefront can draw safely.
// The merchant writes (or pastes from an AI assistant) a small, common subset of
// Markdown; nothing else is understood, and no HTML is ever passed on:
//
//   # Title, ## Section, ### Subsection   headings (4 to 6 # count as level 3)
//   **bold**  __bold__  *italic*  _italic_  ***both***
//   - item  * item  + item  • item          bullet list
//   1. item  1) item                        numbered list
//   (more indentation under an item)        a nested list
//   [text](https://...)                     a link: https, mailto: or tel: only
//   ---                                     a rule
//   \*  \_  \#  \-  \.                      a character that would be markup
//
// A blank line starts a new paragraph; a single line break stays a line break.
// No framework imports, so the rules can be unit tested on their own.

export type TextNode = { type: "text"; text: string; bold?: true; italic?: true }
export type LinkNode = { type: "link"; href: string; children: TextNode[] }
export type BreakNode = { type: "break" }
export type Inline = TextNode | LinkNode | BreakNode

export type ListItem = { content: Inline[]; children: ListBlock[] }
export type ListBlock = { type: "list"; ordered: boolean; items: ListItem[] }

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | ListBlock
  | { type: "rule" }

export const MAX_LIST_DEPTH = 4
const MAX_HREF_LENGTH = 500

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

// A link a storefront may open, or null. Anything else (javascript:, data:, a
// relative path, a link with a password) is not a link.
export function safeHref(input: string): string | null {
  const href = input.trim()
  if (href === "" || href.length > MAX_HREF_LENGTH || /\s/.test(href)) {
    return null
  }
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href)
      if (url.username !== "" || url.password !== "" || url.hostname === "") {
        return null
      }
      return url.href
    } catch {
      return null
    }
  }
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) {
    return href
  }
  if (/^tel:\+?[0-9][0-9().-]*$/i.test(href)) {
    return href
  }
  return null
}

// ---------------------------------------------------------------------------
// Inline text: bold, italic, links, line breaks
// ---------------------------------------------------------------------------

type Flags = { bold: boolean; italic: boolean }

// [label](address), found at an exact position (the lastIndex)
const LINK = /\[([^\]]{0,300})\]\(([^)\s]{0,600})\)/y

const ESCAPABLE = "\\`*_{}[]()#+-.!>~|"

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char)
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9]/.test(char)
}

function pushText(out: Array<TextNode | LinkNode>, text: string, flags: Flags) {
  if (text === "") {
    return
  }
  const last = out[out.length - 1]
  if (last && last.type === "text" && !!last.bold === flags.bold && !!last.italic === flags.italic) {
    last.text += text
    return
  }
  const node: TextNode = { type: "text", text }
  if (flags.bold) node.bold = true
  if (flags.italic) node.italic = true
  out.push(node)
}

// The index of the marker that closes the one at `from`, or -1. A closing marker
// follows a character that is not a space and is a run of exactly the marker's
// length. The one exception is bold ("**") before italic text that ends together
// with it ("**bold *it***"): there the bold marker is the last two of three.
function findClose(text: string, char: string, size: number, from: number): number {
  let at = from
  while (at < text.length) {
    const found = text.indexOf(char, at)
    if (found === -1) {
      return -1
    }
    let end = found
    while (text[end] === char) {
      end++
    }
    const run = end - found

    if (text[found - 1] === "\\") {
      at = found + 1
      continue
    }
    const closes = found > from && !isSpace(text[found - 1])
    if (closes && run === size) {
      return found
    }
    if (closes && size === 2 && run === 3) {
      return found + 1
    }
    at = end
  }
  return -1
}

function parseSpan(text: string, flags: Flags, allowLinks: boolean): Array<TextNode | LinkNode> {
  const out: Array<TextNode | LinkNode> = []
  let i = 0
  let plain = ""

  const flush = () => {
    pushText(out, plain, flags)
    plain = ""
  }

  while (i < text.length) {
    const char = text[i]

    if (char === "\\" && i + 1 < text.length && ESCAPABLE.includes(text[i + 1])) {
      plain += text[i + 1]
      i += 2
      continue
    }

    if (char === "[" && allowLinks) {
      LINK.lastIndex = i
      const match = LINK.exec(text)
      if (match) {
        const href = safeHref(match[2])
        flush()
        const label = parseSpan(match[1], flags, false) as TextNode[]
        if (href && label.length > 0) {
          out.push({ type: "link", href, children: label })
        } else {
          for (const node of label) {
            pushText(out, node.text, { bold: !!node.bold, italic: !!node.italic })
          }
        }
        i += match[0].length
        continue
      }
    }

    if (char === "*" || char === "_") {
      let end = i
      while (text[end] === char) {
        end++
      }
      const run = text.slice(i, end)
      const before = text[i - 1]

      // A run of 1, 2 or 3 may open bold or italic; a longer run is just text
      const sizes = run.length <= 3 ? [run.length] : []
      let opened = false
      for (const size of sizes) {
        const after = text[i + size]
        if (isSpace(after)) {
          continue
        }
        // An underscore inside a word (snake_case) is just an underscore
        if (char === "_" && isWordChar(before)) {
          continue
        }
        const close = findClose(text, char, size, i + size)
        if (close === -1) {
          continue
        }
        if (char === "_" && isWordChar(text[close + size])) {
          continue
        }
        const inner = text.slice(i + size, close)
        const next: Flags =
          size === 3
            ? { bold: true, italic: true }
            : size === 2
              ? { bold: true, italic: flags.italic }
              : { bold: flags.bold, italic: true }
        flush()
        for (const node of parseSpan(inner, next, allowLinks)) {
          if (node.type === "text") {
            pushText(out, node.text, { bold: !!node.bold, italic: !!node.italic })
          } else {
            out.push(node)
          }
        }
        i = close + size
        opened = true
        break
      }
      if (opened) {
        continue
      }
      plain += run
      i += run.length
      continue
    }

    plain += char
    i += 1
  }

  flush()
  return out
}

// One or more lines of text (joined with "\n") as inline nodes. A line break
// becomes a break node.
export function parseInline(text: string): Inline[] {
  const lines = text.split("\n").map((line) => line.replace(/[ \t]+$/, "").replace(/^[ \t]+/, ""))
  const out: Inline[] = []
  lines.forEach((line, index) => {
    if (index > 0) {
      out.push({ type: "break" })
    }
    out.push(...parseSpan(line, { bold: false, italic: false }, true))
  })
  return out
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const HEADING = /^\s{0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/
const RULE = /^\s{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const MARKER = /^([ \t]*)([-*+•]|\d{1,9}[.)])[ \t]+(.*)$/

function indentWidth(spaces: string): number {
  return spaces.replace(/\t/g, "    ").length
}

type Marker = { indent: number; ordered: boolean; number: number; text: string }

function readMarker(line: string): Marker | null {
  if (RULE.test(line)) {
    return null
  }
  const match = MARKER.exec(line)
  if (!match) {
    return null
  }
  const ordered = /\d/.test(match[2])
  return {
    indent: indentWidth(match[1]),
    ordered,
    number: ordered ? parseInt(match[2], 10) : 0,
    text: match[3],
  }
}

function isBlank(line: string): boolean {
  return line.trim() === ""
}

type Level = { indent: number; list: ListBlock; container: Block[] | ListBlock[] }

function parseList(lines: string[], start: number): { block: ListBlock[]; next: number } {
  const roots: ListBlock[] = []
  const stack: Level[] = []
  const raw = new Map<ListItem, string[]>()
  let last: ListItem | null = null
  let i = start

  const newList = (ordered: boolean, container: ListBlock[]): ListBlock => {
    const list: ListBlock = { type: "list", ordered, items: [] }
    container.push(list)
    return list
  }

  while (i < lines.length) {
    const line = lines[i]

    if (isBlank(line)) {
      // A list goes on after a blank line when the next line belongs to it
      let j = i + 1
      while (j < lines.length && isBlank(lines[j])) {
        j++
      }
      if (j >= lines.length) {
        i = j
        break
      }
      const nextLine = lines[j]
      const nextMarker = readMarker(nextLine)
      const continues =
        nextMarker !== null ||
        (indentWidth(/^[ \t]*/.exec(nextLine)![0]) >= 2 && last !== null && !HEADING.test(nextLine))
      if (!continues) {
        break
      }
      i = j
      continue
    }

    const marker = readMarker(line)

    if (!marker) {
      // Not an item: more text of the item above when it is indented, else the list is over
      const indent = indentWidth(/^[ \t]*/.exec(line)![0])
      if (last && indent >= 2 && !HEADING.test(line)) {
        raw.get(last)!.push(line.trim())
        i++
        continue
      }
      break
    }

    // Find the level this item belongs to
    while (stack.length > 0 && stack[stack.length - 1].indent > marker.indent) {
      stack.pop()
    }

    let level = stack[stack.length - 1]
    if (level && level.indent === marker.indent) {
      if (level.list.ordered !== marker.ordered) {
        const list = newList(marker.ordered, level.container as ListBlock[])
        level = { indent: marker.indent, list, container: level.container }
        stack[stack.length - 1] = level
      }
    } else if (level && level.list.items.length > 0 && stack.length < MAX_LIST_DEPTH) {
      // Indented more than the list above: a nested list under its last item
      const parent = level.list.items[level.list.items.length - 1]
      const list = newList(marker.ordered, parent.children)
      level = { indent: marker.indent, list, container: parent.children }
      stack.push(level)
    } else if (level) {
      // Too deep: keep it in the deepest list
    } else {
      const list = newList(marker.ordered, roots)
      level = { indent: marker.indent, list, container: roots }
      stack.push(level)
    }

    const item: ListItem = { content: [], children: [] }
    raw.set(item, [marker.text.trim()])
    level.list.items.push(item)
    last = item
    i++
  }

  const finish = (lists: ListBlock[]) => {
    for (const list of lists) {
      for (const item of list.items) {
        item.content = parseInline(raw.get(item)!.join("\n"))
        finish(item.children)
      }
    }
  }
  finish(roots)

  return { block: roots, next: i }
}

export function parseRichText(input: string): Block[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isBlank(line)) {
      i++
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" })
      i++
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const content = parseInline(heading[2])
      if (content.length > 0) {
        blocks.push({
          type: "heading",
          level: Math.min(heading[1].length, 3) as 1 | 2 | 3,
          content,
        })
      }
      i++
      continue
    }

    if (readMarker(line)) {
      const { block, next } = parseList(lines, i)
      blocks.push(...block)
      i = next
      continue
    }

    // A paragraph: lines until a blank line, or a heading, rule or list begins
    const paragraph: string[] = []
    while (i < lines.length && !isBlank(lines[i])) {
      const current = lines[i]
      if (paragraph.length > 0) {
        const marker = readMarker(current)
        const interrupts =
          RULE.test(current) ||
          HEADING.test(current) ||
          (marker !== null && (!marker.ordered || marker.number === 1))
        if (interrupts) {
          break
        }
      }
      paragraph.push(current)
      i++
    }
    const content = parseInline(paragraph.join("\n"))
    if (content.length > 0) {
      blocks.push({ type: "paragraph", content })
    }
  }

  return blocks
}
