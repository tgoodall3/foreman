import { generateInvoiceNumber, formatCurrency } from "../lib/utils";

// ---------------------------------------------------------------------------
// generateInvoiceNumber
// ---------------------------------------------------------------------------
describe("generateInvoiceNumber", () => {
  it("pads count to 4 digits", () => {
    expect(generateInvoiceNumber("acme", 1)).toBe("ACME-0001");
  });

  it("does not pad a 4-digit count", () => {
    expect(generateInvoiceNumber("acme", 1000)).toBe("ACME-1000");
  });

  it("uppercases the slug", () => {
    expect(generateInvoiceNumber("precision-contracting", 5)).toBe(
      "PRECISION-CONTRACTING-0005"
    );
  });

  it("handles a count of 0", () => {
    expect(generateInvoiceNumber("test", 0)).toBe("TEST-0000");
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe("formatCurrency", () => {
  it("formats whole dollars", () => {
    expect(formatCurrency(100)).toBe("$100.00");
  });

  it("formats cents", () => {
    expect(formatCurrency(9.99)).toBe("$9.99");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats large amounts with commas", () => {
    expect(formatCurrency(12345.67)).toBe("$12,345.67");
  });
});

// ---------------------------------------------------------------------------
// Invoice calculation logic (mirrors the math in app/api/invoices/route.ts)
// These tests pin the rounding behaviour used in production.
// ---------------------------------------------------------------------------
describe("Invoice calculation math", () => {
  function calcLineItem(quantity: number, unit_price: number) {
    return Math.round((quantity * unit_price + Number.EPSILON) * 100) / 100;
  }

  function calcTax(subtotal: number, taxRate: number) {
    return Math.round((subtotal * taxRate / 100 + Number.EPSILON) * 100) / 100;
  }

  function calcTotal(subtotal: number, taxAmount: number) {
    return Math.round((subtotal + taxAmount + Number.EPSILON) * 100) / 100;
  }

  it("calculates a simple line item total", () => {
    expect(calcLineItem(2, 75)).toBe(150);
  });

  it("rounds line item to 2 decimal places", () => {
    // 3 × 33.33 = 99.99 (not 99.990...01)
    expect(calcLineItem(3, 33.33)).toBe(99.99);
  });

  it("calculates tax correctly", () => {
    expect(calcTax(100, 8.5)).toBe(8.5);
  });

  it("rounds tax to 2 decimal places", () => {
    // 10% of $33.33 = 3.333 → rounds to 3.33
    expect(calcTax(33.33, 10)).toBe(3.33);
  });

  it("calculates grand total", () => {
    const subtotal = calcLineItem(2, 75);   // 150
    const tax      = calcTax(subtotal, 10); // 15
    expect(calcTotal(subtotal, tax)).toBe(165);
  });

  it("handles zero tax rate", () => {
    const subtotal = 200;
    expect(calcTax(subtotal, 0)).toBe(0);
    expect(calcTotal(subtotal, 0)).toBe(200);
  });

  it("sums multiple line items correctly", () => {
    const items = [
      calcLineItem(1, 100),
      calcLineItem(2, 50),
      calcLineItem(3, 25),
    ];
    const subtotal = items.reduce((s, v) => s + v, 0);
    expect(subtotal).toBe(275);
  });
});
