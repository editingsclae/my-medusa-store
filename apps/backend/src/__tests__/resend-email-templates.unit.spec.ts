import {
  EMAIL_TEMPLATES,
  EmailDataError,
  countryName,
  escapeHtml,
  formatFrom,
  formatMoney,
  oneLine,
  renderEmail,
  renderOrderPlaced,
  safeHttpUrl,
  toNumber,
} from "../modules/resend/email-templates"

function thrown(fn: () => unknown): any {
  try {
    fn()
  } catch (e) {
    return e
  }
  return null
}

function order(extra: Record<string, unknown> = {}) {
  return {
    id: "order_01",
    display_id: 45,
    email: "buyer@example.com",
    currency_code: "tnd",
    sales_channel: { name: "ZARA" },
    items: [
      {
        title: "iPhone 16 Pro Max",
        product_title: "iPhone 16 Pro Max",
        variant_title: "256GB",
        thumbnail: "https://files.example.com/a.jpg",
        quantity: 2,
        unit_price: 899,
      },
    ],
    shipping_address: {
      first_name: "Sami",
      last_name: "Ben Ali",
      address_1: "12 Rue de Marseille",
      city: "Tunis",
      postal_code: "1000",
      country_code: "tn",
      phone: "20123456",
    },
    shipping_methods: [{ name: "Standard delivery" }],
    item_subtotal: 1798,
    shipping_subtotal: 7,
    discount_total: 0,
    tax_total: 0,
    total: 1805,
    ...extra,
  }
}

function render(extra: Record<string, unknown> = {}) {
  return renderOrderPlaced({ order: order(extra) })
}

describe("escapeHtml", () => {
  it("escapes the characters that can start markup", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
    )
  })

  it("gives an empty string for nothing", () => {
    expect(escapeHtml(undefined)).toBe("")
    expect(escapeHtml(null)).toBe("")
  })
})

describe("oneLine", () => {
  it("turns line breaks and control characters into single spaces", () => {
    expect(oneLine("a\r\nb\tc\u0000d")).toBe("a b c d")
    expect(oneLine("  x   y  ")).toBe("x y")
  })

  it("cuts long text", () => {
    expect(oneLine("a".repeat(500), 10)).toBe("a".repeat(10))
  })

  it("gives an empty string for nothing", () => {
    expect(oneLine(undefined)).toBe("")
    expect(oneLine(null)).toBe("")
  })
})

describe("toNumber", () => {
  it("reads numbers, numeric strings and big number objects", () => {
    expect(toNumber(5)).toBe(5)
    expect(toNumber("12.5")).toBe(12.5)
    expect(toNumber({ numeric_: 7 })).toBe(7)
    expect(toNumber({ value: "9" })).toBe(9)
  })

  it("gives 0 for anything else", () => {
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber("abc")).toBe(0)
    expect(toNumber(NaN)).toBe(0)
    expect(toNumber(Infinity)).toBe(0)
    expect(toNumber({})).toBe(0)
  })
})

describe("formatMoney", () => {
  it("shows the currency and two decimals like the storefront", () => {
    expect(formatMoney(700, "tnd")).toBe("TND 700.00")
    expect(formatMoney("333.07", "TND")).toBe("TND 333.07")
    expect(formatMoney(undefined, "tnd")).toBe("TND 0.00")
  })

  it("works without a currency", () => {
    expect(formatMoney(5, undefined)).toBe("5.00")
  })
})

describe("safeHttpUrl", () => {
  it("accepts http and https addresses", () => {
    expect(safeHttpUrl("https://files.example.com/a.jpg")).toBe("https://files.example.com/a.jpg")
    expect(safeHttpUrl("http://localhost:9000/a.jpg")).toBe("http://localhost:9000/a.jpg")
  })

  it("refuses everything else", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBe(null)
    expect(safeHttpUrl("data:image/png;base64,AAAA")).toBe(null)
    expect(safeHttpUrl("/relative.jpg")).toBe(null)
    expect(safeHttpUrl("https://x.com/a b.jpg")).toBe(null)
    expect(safeHttpUrl("")).toBe(null)
    expect(safeHttpUrl(undefined)).toBe(null)
  })
})

describe("formatFrom", () => {
  it("puts the store name in front of the configured address", () => {
    expect(formatFrom("orders@getcardy.shop", "ZARA")).toBe("ZARA <orders@getcardy.shop>")
  })

  it("replaces the name of an address that already has one", () => {
    expect(formatFrom("GetCardy <orders@getcardy.shop>", "ZARA")).toBe("ZARA <orders@getcardy.shop>")
  })

  it("uses the configured value when there is no usable name", () => {
    expect(formatFrom("orders@getcardy.shop", null)).toBe("orders@getcardy.shop")
    expect(formatFrom("orders@getcardy.shop", "  ")).toBe("orders@getcardy.shop")
    expect(formatFrom("GetCardy <orders@getcardy.shop>", undefined)).toBe("GetCardy <orders@getcardy.shop>")
    expect(formatFrom("orders@getcardy.shop", "<>@;:")).toBe("orders@getcardy.shop")
  })

  it("keeps a name from looking like another address or breaking the header", () => {
    expect(formatFrom("orders@getcardy.shop", "paypal@evil.com")).toBe("paypal evil.com <orders@getcardy.shop>")
    expect(formatFrom("orders@getcardy.shop", 'Shop "A" <x>')).toBe("Shop A x <orders@getcardy.shop>")
    expect(formatFrom("orders@getcardy.shop", "ZARA\r\nBcc: x@y.com")).toBe("ZARA Bcc x y.com <orders@getcardy.shop>")
  })

  it("cuts a very long name", () => {
    const from = formatFrom("orders@getcardy.shop", "A".repeat(200))
    expect(from).toBe(`${"A".repeat(60)} <orders@getcardy.shop>`)
  })
})

describe("countryName", () => {
  it("gives the English name of a country code", () => {
    expect(countryName("tn")).toBe("Tunisia")
    expect(countryName("FR")).toBe("France")
  })

  it("gives nothing for a value that is not a country code", () => {
    expect(countryName(undefined)).toBe("")
    expect(countryName("")).toBe("")
    expect(countryName("T")).toBe("")
  })
})

describe("renderEmail", () => {
  it("gives null for a template that does not exist", () => {
    expect(renderEmail("nope", {})).toBe(null)
    expect(renderEmail("", {})).toBe(null)
  })

  it("renders the order-placed template", () => {
    const email = renderEmail(EMAIL_TEMPLATES.ORDER_PLACED, { order: order() })
    expect(email === null).toBe(false)
    expect((email as any).subject).toBe("Your order #45 from ZARA is confirmed")
  })

  it("refuses order data it cannot use", () => {
    expect(thrown(() => renderEmail("order-placed", undefined)) instanceof EmailDataError).toBe(true)
    expect(thrown(() => renderEmail("order-placed", {})) instanceof EmailDataError).toBe(true)
    expect(thrown(() => renderEmail("order-placed", { order: {} })) instanceof EmailDataError).toBe(true)
    expect(thrown(() => renderEmail("order-placed", { order: "x" })) instanceof EmailDataError).toBe(true)
  })
})

describe("order confirmation", () => {
  it("names the store and the order in the subject and the sender name", () => {
    const email = render()
    expect(email.subject).toBe("Your order #45 from ZARA is confirmed")
    expect(email.fromName).toBe("ZARA")
  })

  it("works without a store name", () => {
    const email = render({ sales_channel: null })
    expect(email.subject).toBe("Your order #45 is confirmed")
    expect(email.fromName).toBe(null)
  })

  it("uses the order id when there is no display id", () => {
    expect(render({ display_id: null }).subject).toBe("Your order #order_01 from ZARA is confirmed")
  })

  it("keeps a store name from adding lines to the subject", () => {
    const email = render({ sales_channel: { name: "ZARA\r\nBcc: x@y.com" } })
    expect(email.subject).toBe("Your order #45 from ZARA Bcc: x@y.com is confirmed")
    expect(/[\r\n]/.test(email.subject)).toBe(false)
  })

  it("shows the items, the prices and the totals", () => {
    const email = render()
    expect(email.html).toContain("iPhone 16 Pro Max")
    expect(email.html).toContain("256GB")
    expect(email.html).toContain("2 x TND 899.00")
    expect(email.html).toContain("TND 1798.00")
    expect(email.html).toContain("TND 7.00")
    expect(email.html).toContain("TND 1805.00")
    expect(email.html).toContain("Delivery (Standard delivery)")
  })

  it("says the order is paid on delivery", () => {
    const email = render()
    expect(email.html).toContain("Cash on delivery")
    expect(email.text).toContain("Payment: cash on delivery")
  })

  it("shows the delivery address and the name of the buyer", () => {
    const email = render()
    expect(email.html).toContain("Hi Sami,")
    expect(email.html).toContain("12 Rue de Marseille")
    expect(email.html).toContain("1000 Tunis")
    expect(email.html).toContain("Tunisia")
    expect(email.html.includes(">TN<")).toBe(false)
    expect(email.html).toContain("Phone: 20123456")
  })

  it("greets without a name and skips the address when there is none", () => {
    const email = render({ shipping_address: null })
    expect(email.html).toContain("Hello,")
    expect(email.html.includes("Delivery address")).toBe(false)
    expect(email.text.includes("Delivery address")).toBe(false)
  })

  it("shows a discount or a tax row only when there is an amount", () => {
    const plain = render()
    expect(plain.html.includes("Discount")).toBe(false)
    expect(plain.html.includes(">Tax<")).toBe(false)

    const withBoth = render({ discount_total: 50, tax_total: 19 })
    expect(withBoth.html).toContain("Discount")
    expect(withBoth.html).toContain("-TND 50.00")
    expect(withBoth.html).toContain(">Tax<")
    expect(withBoth.html).toContain("TND 19.00")
  })

  it("does not repeat a variant title that equals the product title", () => {
    const email = render({
      items: [{ title: "Mug", product_title: "Mug", variant_title: "Mug", quantity: 1, unit_price: 5 }],
    })
    expect(email.html.split("Mug").length - 1).toBe(1)
  })

  it("does not show the placeholder variant title Medusa gives a product without options", () => {
    for (const title of ["Default variant", "Default Option Value", "default", "Default title"]) {
      const email = render({
        items: [{ title: "Mug", variant_title: title, quantity: 1, unit_price: 5 }],
      })
      expect(email.html.includes(title)).toBe(false)
      expect(email.text).toContain("- Mug: 1 x TND 5.00")
    }
  })

  it("keeps a real variant title that starts with Default", () => {
    const email = render({
      items: [{ title: "Mug", variant_title: "Default blue", quantity: 1, unit_price: 5 }],
    })
    expect(email.html).toContain("Default blue")
  })

  it("leaves out a province that only repeats the city", () => {
    const same = render({ shipping_address: { city: "Tunis", province: "tunis", country_code: "tn" } })
    const sameLines = same.text.split("\n").filter((line) => /^tunis$/i.test(line))
    expect(sameLines).toHaveLength(1)

    const different = render({ shipping_address: { city: "La Marsa", province: "Tunis", country_code: "tn" } })
    expect(different.text).toContain("La Marsa")
    expect(different.text).toContain("Tunis")
  })

  it("leaves out the picture column when no item has a picture", () => {
    const none = render({ items: [{ title: "Mug", quantity: 1, unit_price: 5 }] })
    expect(none.html.includes('width:56px')).toBe(false)
    expect(render().html).toContain("width:56px")
  })

  it("reads big number objects and numeric strings", () => {
    const email = render({
      items: [{ title: "Mug", quantity: "3", unit_price: { numeric_: 10 } }],
      total: { value: "30" },
    })
    expect(email.html).toContain("3 x TND 10.00")
    expect(email.html).toContain("TND 30.00")
  })

  it("works for an order with no items", () => {
    const email = render({ items: [] })
    expect(email.subject).toBe("Your order #45 from ZARA is confirmed")
  })

  it("escapes everything that comes from the order or the merchant", () => {
    const evil = `<script>alert(1)</script>`
    const email = render({
      sales_channel: { name: evil },
      items: [{ title: evil, variant_title: evil, quantity: 1, unit_price: 1, thumbnail: "https://x.com/a.jpg" }],
      shipping_address: {
        first_name: evil,
        address_1: evil,
        city: evil,
        phone: evil,
      },
      shipping_methods: [{ name: evil }],
    })
    expect(email.html.includes("<script>")).toBe(false)
    expect(email.html).toContain("&lt;script&gt;")
  })

  it("only shows pictures with an http or https address", () => {
    const unsafe = render({
      items: [{ title: "A", quantity: 1, unit_price: 1, thumbnail: "javascript:alert(1)" }],
    })
    expect(unsafe.html.includes("<img")).toBe(false)

    const safe = render()
    expect(safe.html).toContain('<img src="https://files.example.com/a.jpg"')
  })

  it("has a plain text version with the items and the totals", () => {
    const email = render()
    expect(email.text).toContain("ZARA")
    expect(email.text).toContain("iPhone 16 Pro Max (256GB): 2 x TND 899.00 = TND 1798.00")
    expect(email.text).toContain("Total: TND 1805.00")
    expect(email.text).toContain("12 Rue de Marseille")
    expect(email.text.includes("<")).toBe(false)
  })
})
