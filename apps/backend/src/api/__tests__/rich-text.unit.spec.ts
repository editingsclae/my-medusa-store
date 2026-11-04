import { parseInline, parseRichText, safeHref, type Block, type Inline } from "../rich-text"

// A compact way to read blocks in a test
function show(content: Inline[]): string {
  return content
    .map((node) => {
      if (node.type === "break") return "<br>"
      if (node.type === "link") {
        return `[${node.children.map((c) => c.text).join("")}](${node.href})`
      }
      let text = node.text
      if (node.bold && node.italic) text = `<bi>${text}</bi>`
      else if (node.bold) text = `<b>${text}</b>`
      else if (node.italic) text = `<i>${text}</i>`
      return text
    })
    .join("")
}

function outline(blocks: Block[], depth = 0): string[] {
  const pad = "  ".repeat(depth)
  const lines: string[] = []
  for (const block of blocks) {
    if (block.type === "heading") lines.push(`${pad}h${block.level}: ${show(block.content)}`)
    else if (block.type === "paragraph") lines.push(`${pad}p: ${show(block.content)}`)
    else if (block.type === "rule") lines.push(`${pad}rule`)
    else {
      lines.push(`${pad}${block.ordered ? "ol" : "ul"}`)
      for (const item of block.items) {
        lines.push(`${pad}  - ${show(item.content)}`)
        lines.push(...outline(item.children, depth + 2))
      }
    }
  }
  return lines
}

function o(text: string): string[] {
  return outline(parseRichText(text))
}

describe("safeHref", () => {
  it("accepts https, http, mailto and tel links", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1")
    expect(safeHref("http://example.com")).toBe("http://example.com/")
    expect(safeHref("mailto:shop@example.com")).toBe("mailto:shop@example.com")
    expect(safeHref("tel:+21612345678")).toBe("tel:+21612345678")
    expect(safeHref("tel:71-123-456")).toBe("tel:71-123-456")
  })

  it("refuses everything else", () => {
    for (const bad of [
      "",
      "   ",
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "/relative/path",
      "//evil.com",
      "example.com",
      "ftp://example.com",
      "https://user:pass@example.com",
      "https://",
      "javascript://example.com/%0Aalert(1)",
      "JAVASCRIPT:alert(1)",
      "mailto:nobody",
      "tel:abc",
      "tel:+216 12 345",
      "https://a.com/ b",
      "https://example.com/" + "a".repeat(600),
    ]) {
      expect(safeHref(bad)).toBe(null)
    }
  })
})

describe("parseInline", () => {
  it("keeps plain text as it is", () => {
    expect(show(parseInline("Hello world"))).toBe("Hello world")
    expect(parseInline("")).toEqual([])
  })

  it("reads bold, italic and both", () => {
    expect(show(parseInline("a **b** c"))).toBe("a <b>b</b> c")
    expect(show(parseInline("a __b__ c"))).toBe("a <b>b</b> c")
    expect(show(parseInline("a *b* c"))).toBe("a <i>b</i> c")
    expect(show(parseInline("a _b_ c"))).toBe("a <i>b</i> c")
    expect(show(parseInline("a ***b*** c"))).toBe("a <bi>b</bi> c")
    expect(show(parseInline("**bold and *italic* inside**"))).toBe("<b>bold and </b><bi>italic</bi><b> inside</b>")
    expect(show(parseInline("**bold and *italic***"))).toBe("<b>bold and </b><bi>italic</bi>")
    expect(show(parseInline("*italic with **bold** inside*"))).toBe("<i>italic with </i><bi>bold</bi><i> inside</i>")
    expect(show(parseInline("*a* and *b*"))).toBe("<i>a</i> and <i>b</i>")
    expect(show(parseInline("**a** and **b**"))).toBe("<b>a</b> and <b>b</b>")
  })

  it("leaves markers that do not pair up as text", () => {
    expect(show(parseInline("2 * 3 * 4"))).toBe("2 * 3 * 4")
    expect(show(parseInline("a * b"))).toBe("a * b")
    expect(show(parseInline("**never closed"))).toBe("**never closed")
    expect(show(parseInline("a ** b ** c"))).toBe("a ** b ** c")
    expect(show(parseInline("****"))).toBe("****")
    expect(show(parseInline("**** not bold ****"))).toBe("**** not bold ****")
    expect(show(parseInline("snake_case_name and file_name"))).toBe("snake_case_name and file_name")
    expect(show(parseInline("foo_bar_ baz"))).toBe("foo_bar_ baz")
    expect(show(parseInline("a * b* c"))).toBe("a * b* c")
    expect(show(parseInline("a _ b_ c"))).toBe("a _ b_ c")
  })

  it("reads an escaped marker as the character", () => {
    expect(show(parseInline("price \\* 2"))).toBe("price * 2")
    expect(show(parseInline("\\*not italic\\*"))).toBe("*not italic*")
    expect(show(parseInline("a \\_b\\_ c"))).toBe("a _b_ c")
    expect(show(parseInline("a \\\\ b"))).toBe("a \\ b")
  })

  it("keeps a backslash that does not escape anything", () => {
    expect(show(parseInline("C:\\path and \\n"))).toBe("C:\\path and \\n")
  })

  it("turns a line break into a break node and trims each line", () => {
    expect(show(parseInline("one  \n   two\nthree"))).toBe("one<br>two<br>three")
  })

  it("reads links and keeps emphasis inside the label", () => {
    expect(show(parseInline("see [our shop](https://example.com/shop) now"))).toBe("see [our shop](https://example.com/shop) now")
    const nodes = parseInline("**[Call us](tel:+21671000000)**")
    expect(nodes).toEqual([
      { type: "link", href: "tel:+21671000000", children: [{ type: "text", text: "Call us", bold: true }] },
    ])
    expect(show(parseInline("[**Mail**](mailto:a@b.tn)"))).toBe("[Mail](mailto:a@b.tn)")
  })

  it("keeps only the label of a link that is not allowed", () => {
    expect(show(parseInline("[click](/admin) and [x](data:text/html,a)"))).toBe("click and x")
    expect(parseInline("[click](javascript:x)").some((n) => n.type === "link")).toBe(false)
    expect(show(parseInline("[click](javascript:x)"))).toBe("click")
    // the closing bracket of the address ends the match, so text is left over
    expect(parseInline("[click](javascript:alert(1))").some((n) => n.type === "link")).toBe(false)
  })

  it("does not read a link inside a link label or half a link", () => {
    const nested = parseInline("[a [b](https://x.com) c](https://y.com)")
    expect(nested.filter((n) => n.type === "link")).toHaveLength(1)
    expect(nested.every((n) => n.type !== "link" || !n.children.some((c: any) => c.type === "link"))).toBe(true)
    expect(show(parseInline("[open] (not a link)"))).toBe("[open] (not a link)")
    expect(show(parseInline("[open](https://example.com"))).toBe("[open](https://example.com")
  })

  it("never produces html: angle brackets stay text", () => {
    const nodes = parseInline("<script>alert(1)</script> <b>x</b>")
    expect(nodes).toEqual([{ type: "text", text: "<script>alert(1)</script> <b>x</b>" }])
  })
})

describe("headings, paragraphs and rules", () => {
  it("reads headings of every level, and 4 to 6 count as level 3", () => {
    expect(o("# One\n## Two\n### Three\n#### Four\n###### Six")).toEqual([
      "h1: One",
      "h2: Two",
      "h3: Three",
      "h3: Four",
      "h3: Six",
    ])
  })

  it("needs a space after the hashes and drops closing hashes", () => {
    expect(o("#hashtag")).toEqual(["p: #hashtag"])
    expect(o("## Title ##")).toEqual(["h2: Title"])
    expect(o("####### seven")).toEqual(["p: ####### seven"])
    expect(o("##   ")).toEqual([])
    expect(o("#")).toEqual(["p: #"])
  })

  it("keeps bold and links inside a heading", () => {
    expect(o("## 1. About **Zara**")).toEqual(["h2: 1. About <b>Zara</b>"])
  })

  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(o("First line\nsecond line\n\n\n\nNext paragraph")).toEqual([
      "p: First line<br>second line",
      "p: Next paragraph",
    ])
  })

  it("reads a rule", () => {
    expect(o("a\n\n---\n\nb")).toEqual(["p: a", "rule", "p: b"])
    expect(o("***")).toEqual(["rule"])
    expect(o("_____")).toEqual(["rule"])
    expect(o("--")).toEqual(["p: --"])
  })

  it("a heading or rule ends a paragraph without a blank line", () => {
    expect(o("text\n## Next\nmore")).toEqual(["p: text", "h2: Next", "p: more"])
    expect(o("text\n---\nmore")).toEqual(["p: text", "rule", "p: more"])
  })

  it("gives nothing for empty text", () => {
    expect(o("")).toEqual([])
    expect(o("  \n \n\t\n")).toEqual([])
  })

  it("understands Windows and old Mac line ends", () => {
    expect(o("# A\r\n\r\nText\r\n- x\r- y")).toEqual(["h1: A", "p: Text", "ul", "  - x", "  - y"])
  })
})

describe("lists", () => {
  it("reads bullets with every marker", () => {
    expect(o("- a\n* b\n+ c\n\u2022 d")).toEqual(["ul", "  - a", "  - b", "  - c", "  - d"])
  })

  it("reads numbered lists with . and )", () => {
    expect(o("1. a\n2) b\n10. c")).toEqual(["ol", "  - a", "  - b", "  - c"])
  })

  it("nests by indentation, whatever the width", () => {
    for (const pad of ["  ", "   ", "    ", "\t"]) {
      expect(o(`- a\n${pad}- a1\n${pad}- a2\n- b`)).toEqual([
        "ul",
        "  - a",
        "    ul",
        "      - a1",
        "      - a2",
        "  - b",
      ])
    }
  })

  it("nests a bullet list under a numbered item and goes back out", () => {
    expect(o("1. First\n   - one\n   - two\n2. Second\n   - three")).toEqual([
      "ol",
      "  - First",
      "    ul",
      "      - one",
      "      - two",
      "  - Second",
      "    ul",
      "      - three",
    ])
  })

  it("goes down more than one level and back up", () => {
    expect(o("- a\n  - b\n    - c\n  - d\n- e")).toEqual([
      "ul",
      "  - a",
      "    ul",
      "      - b",
      "        ul",
      "          - c",
      "      - d",
      "  - e",
    ])
  })

  it("keeps a list that has blank lines between its items", () => {
    expect(o("1. a\n\n2. b\n\n   - c\n\n3. d")).toEqual([
      "ol",
      "  - a",
      "  - b",
      "    ul",
      "      - c",
      "  - d",
    ])
  })

  it("starts a new list when the kind changes at the same level", () => {
    expect(o("- a\n- b\n1. c\n2. d")).toEqual(["ul", "  - a", "  - b", "ol", "  - c", "  - d"])
  })

  it("keeps the text of an item that goes on the next line", () => {
    expect(o("1. **Title**\n   The description\n   more\n2. Next")).toEqual([
      "ol",
      "  - <b>Title</b><br>The description<br>more",
      "  - Next",
    ])
  })

  it("ends the list at a paragraph that is not indented", () => {
    expect(o("- a\n- b\n\nAfter the list")).toEqual(["ul", "  - a", "  - b", "p: After the list"])
    expect(o("- a\nAfter without blank")).toEqual(["ul", "  - a", "p: After without blank"])
  })

  it("ends the list at a heading", () => {
    expect(o("- a\n\n## Next\n- b")).toEqual(["ul", "  - a", "h2: Next", "ul", "  - b"])
  })

  it("a list may follow a line of text without a blank line", () => {
    expect(o("You confirm that:\n- one\n- two")).toEqual(["p: You confirm that:", "ul", "  - one", "  - two"])
    expect(o("Steps:\n1. one\n2. two")).toEqual(["p: Steps:", "ol", "  - one", "  - two"])
  })

  it("a number in the middle of a paragraph does not start a list", () => {
    expect(o("It happened in\n2026. A great year")).toEqual(["p: It happened in<br>2026. A great year"])
  })

  it("an escaped marker is text", () => {
    expect(o("\\- not a list")).toEqual(["p: - not a list"])
    expect(o("1\\. not a list")).toEqual(["p: 1. not a list"])
    expect(o("\\# not a heading")).toEqual(["p: # not a heading"])
  })

  it("bold at the start of a line is not a bullet", () => {
    expect(o("**Note:** careful")).toEqual(["p: <b>Note:</b> careful"])
    expect(o("*emphasis* first")).toEqual(["p: <i>emphasis</i> first"])
  })

  it("never nests deeper than the limit", () => {
    const lines = Array.from({ length: 8 }, (_, i) => `${"  ".repeat(i)}- level ${i}`).join("\n")
    let depth = 0
    let blocks = parseRichText(lines)
    while (blocks.length > 0 && blocks[0].type === "list") {
      depth++
      blocks = (blocks[0] as any).items[(blocks[0] as any).items.length - 1].children
    }
    expect(depth).toBe(4)
    // nothing is lost
    expect(o(lines).filter((l) => l.includes("level"))).toHaveLength(8)
  })

  it("a list that starts indented still works, and a later smaller indent starts another", () => {
    expect(o("    - a\n    - b")).toEqual(["ul", "  - a", "  - b"])
    expect(o("    - a\n- b")).toEqual(["ul", "  - a", "ul", "  - b"])
  })

  it("is not fooled by a rule that looks like a bullet", () => {
    expect(o("- a\n\n---\n\n- b")).toEqual(["ul", "  - a", "rule", "ul", "  - b"])
    expect(o("* * *")).toEqual(["rule"])
    expect(o("- - -")).toEqual(["rule"])
  })
})

describe("a page as an AI assistant writes it", () => {
  const sample = [
    "# Terms of Service",
    "",
    "**Zara Electronics**",
    "",
    "**Last Updated:** November 4, 2026",
    "",
    "Welcome to Zara Electronics. These Terms of Service govern your access.",
    "",
    "Please read them carefully before making a purchase.",
    "",
    "## 1. About Zara Electronics",
    "",
    "Zara Electronics is an e-commerce store based in Tunisia.",
    "",
    "## 2. Eligibility",
    "",
    "By using our website, you confirm that:",
    "",
    "- You are legally capable of entering into a purchase agreement.",
    "- You provide accurate information.",
    "  - Name and phone number",
    "  - Delivery address",
    "",
    "## 3. Contact",
    "",
    "1. Email: [support@zara.tn](mailto:support@zara.tn)",
    "2. Phone: [+216 71 000 000](tel:+21671000000)",
    "",
    "---",
    "",
    "*Thank you for shopping with us.*",
  ].join("\n")

  it("keeps the structure", () => {
    expect(o(sample)).toEqual([
      "h1: Terms of Service",
      "p: <b>Zara Electronics</b>",
      "p: <b>Last Updated:</b> November 4, 2026",
      "p: Welcome to Zara Electronics. These Terms of Service govern your access.",
      "p: Please read them carefully before making a purchase.",
      "h2: 1. About Zara Electronics",
      "p: Zara Electronics is an e-commerce store based in Tunisia.",
      "h2: 2. Eligibility",
      "p: By using our website, you confirm that:",
      "ul",
      "  - You are legally capable of entering into a purchase agreement.",
      "  - You provide accurate information.",
      "    ul",
      "      - Name and phone number",
      "      - Delivery address",
      "h2: 3. Contact",
      "ol",
      "  - Email: [support@zara.tn](mailto:support@zara.tn)",
      "  - Phone: [+216 71 000 000](tel:+21671000000)",
      "rule",
      "p: <i>Thank you for shopping with us.</i>",
    ])
  })

  it("gives the same blocks every time and never changes its input", () => {
    const copy = sample.slice()
    expect(parseRichText(sample)).toEqual(parseRichText(copy))
    expect(sample).toBe(copy)
  })

  it("handles a long page quickly", () => {
    const long = Array.from({ length: 800 }, (_, i) => `## Section ${i}\n\nSome **text** here.\n\n- a\n  - b\n`).join("\n")
    const start = Date.now()
    const blocks = parseRichText(long)
    expect(blocks.length).toBe(2400)
    expect(Date.now() - start < 2000).toBe(true)
  })

  it("is not slowed down by long runs of markers", () => {
    const start = Date.now()
    parseRichText("*".repeat(5000) + "\n" + "_ ".repeat(3000) + "\n" + "[".repeat(3000) + "\n" + "**a ".repeat(2000))
    expect(Date.now() - start < 2000).toBe(true)
  })
})
