import crypto from "crypto";

/**
 * Signed unsubscribe tokens. Without a signature, anyone could unsubscribe any
 * address by guessing a URL (/api/newsletter/unsubscribe?email=victim@...).
 * The token is an HMAC of the email, so only links we generated are valid.
 */
function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be set to sign unsubscribe links");
  return secret;
}

export function unsubscribeToken(email: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`unsubscribe:${email.trim().toLowerCase()}`)
    .digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function buildUnsubscribeUrl(baseUrl: string, email: string): string {
  return `${baseUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken(email)}`;
}
