import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function createReconnectToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashReconnectToken(token) };
}

export function hashReconnectToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function reconnectTokenMatches(token: string, tokenHash: string): boolean {
  const actual = Buffer.from(hashReconnectToken(token));
  const expected = Buffer.from(tokenHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
