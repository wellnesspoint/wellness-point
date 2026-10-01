import { describe, it, expect } from "vitest";
import { validateShippingAddress, isLikelyImageFile, escapeHtml } from "@/lib/utils";

const good = {
  fullName: "Mary-Jane O'Brien",
  email: "a@b.co",
  phone: "9876543210",
  street: "12 MG Road",
  city: "St. Thomas Mount",
  state: "Tamil Nadu",
  pincode: "600016",
};

describe("validateShippingAddress", () => {
  it("accepts a valid address", () => {
    expect(validateShippingAddress(good).valid).toBe(true);
  });
  it.each([
    ["fullName", "<script>"],
    ["email", "nope"],
    ["phone", "12345"],
    ["pincode", "60001"],
    ["city", "123"],
  ])("rejects bad %s", (field, value) => {
    expect(validateShippingAddress({ ...good, [field]: value }).valid).toBe(false);
  });
  it("strips angle brackets from free-text fields", () => {
    const r = validateShippingAddress({ ...good, street: "1 <b>Main</b> St" });
    expect(r.valid && r.address.street).toBe("1 bMain/b St");
  });
});

describe("isLikelyImageFile", () => {
  const pad = (b: number[]) => Buffer.from([...b, ...new Array(16).fill(0)]);
  it("accepts PNG / JPEG / GIF magic bytes", () => {
    expect(isLikelyImageFile(pad([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    expect(isLikelyImageFile(pad([0xff, 0xd8, 0xff]))).toBe(true);
    expect(isLikelyImageFile(pad([0x47, 0x49, 0x46, 0x38]))).toBe(true);
  });
  it("rejects HTML/SVG masquerading as an image", () => {
    expect(isLikelyImageFile(Buffer.from("<svg onload=alert(1)></svg>"))).toBe(false);
    expect(isLikelyImageFile(Buffer.from("<html><script>x</script></html>"))).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<a href="x">'&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;");
  });
});
