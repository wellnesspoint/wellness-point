import { describe, it, expect } from "vitest";
import { unsubscribeToken, verifyUnsubscribeToken, buildUnsubscribeUrl } from "@/lib/unsubscribe";

describe("unsubscribe tokens", () => {
  it("verifies a token it issued, case-insensitively on the email", () => {
    const t = unsubscribeToken("User@Example.com");
    expect(verifyUnsubscribeToken("user@example.com", t)).toBe(true);
  });
  it("rejects a token for a different address", () => {
    const t = unsubscribeToken("a@example.com");
    expect(verifyUnsubscribeToken("b@example.com", t)).toBe(false);
  });
  it("rejects missing / tampered / wrong-length tokens", () => {
    expect(verifyUnsubscribeToken("a@example.com", "")).toBe(false);
    expect(verifyUnsubscribeToken("a@example.com", "abc")).toBe(false);
    const t = unsubscribeToken("a@example.com");
    expect(verifyUnsubscribeToken("a@example.com", t.slice(0, -1) + (t.endsWith("0") ? "1" : "0"))).toBe(false);
  });
  it("builds a URL carrying the token", () => {
    const url = buildUnsubscribeUrl("https://x.test", "a@example.com");
    expect(url).toContain("token=" + unsubscribeToken("a@example.com"));
  });
});
