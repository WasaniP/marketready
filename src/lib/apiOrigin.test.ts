/**
 * Tests for the canonical-origin helper (src/lib/apiOrigin.ts).
 *
 * Guards the apex→www 308 fix: pages served from the bare apex
 * (getmarketready.co) must POST to https://www.getmarketready.co so the
 * request never crosses the 308 (which can re-issue a POST as GET and drop
 * the lead body). Every other host keeps its own origin.
 */
import { describe, test, expect } from "bun:test";
import { resolveApiOrigin, CANONICAL_ORIGIN } from "./apiOrigin";

describe("resolveApiOrigin", () => {
  test("bare apex maps to the canonical www origin", () => {
    expect(resolveApiOrigin("getmarketready.co", "https://getmarketready.co")).toBe(
      CANONICAL_ORIGIN,
    );
  });

  test("mapping is case-insensitive", () => {
    expect(resolveApiOrigin("GetMarketReady.CO", "https://getmarketready.co")).toBe(
      CANONICAL_ORIGIN,
    );
  });

  test("www host keeps its own origin", () => {
    expect(
      resolveApiOrigin("www.getmarketready.co", "https://www.getmarketready.co"),
    ).toBe("https://www.getmarketready.co");
  });

  test("platform / preview / localhost hosts keep their own origin", () => {
    expect(resolveApiOrigin("59e104a5a8878f58fb5893d4b7ec1597.ctonew.app", "https://59e104a5a8878f58fb5893d4b7ec1597.ctonew.app")).toBe(
      "https://59e104a5a8878f58fb5893d4b7ec1597.ctonew.app",
    );
    expect(resolveApiOrigin("localhost", "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(resolveApiOrigin("my-preview.vercel.app", "https://my-preview.vercel.app")).toBe(
      "https://my-preview.vercel.app",
    );
  });

  test("canonical domain is never returned for foreign hosts", () => {
    expect(resolveApiOrigin("example.com", "https://example.com")).not.toBe(
      CANONICAL_ORIGIN,
    );
  });
});
