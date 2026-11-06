import { describe, expect, it } from "vitest";
import {
  createReconnectToken,
  hashReconnectToken,
  reconnectTokenMatches,
} from "./reconnectToken.ts";

describe("reconnect tokens", () => {
  it("accepts the token that was just issued", () => {
    const issued = createReconnectToken();
    expect(issued.token).not.toBe(issued.tokenHash);
    expect(reconnectTokenMatches(issued.token, issued.tokenHash)).toBe(true);
  });

  it("rejects a different token for the same hash", () => {
    const issued = createReconnectToken();
    const other = createReconnectToken();
    expect(reconnectTokenMatches(other.token, issued.tokenHash)).toBe(false);
  });

  it("does not treat the hash as a usable token", () => {
    const issued = createReconnectToken();
    expect(reconnectTokenMatches(issued.tokenHash, issued.tokenHash)).toBe(false);
    expect(hashReconnectToken(issued.token)).toBe(issued.tokenHash);
  });
});
