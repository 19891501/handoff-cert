import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalize, sha256Hex } from "../handoff/hash.ts";
import { jcs, shuffleKeys } from "../format/jcs.ts";

const LOCALE_TRAP: Record<string, number> = { n: 1, o: 3, ñ: 2 };

describe("canonicalize RFC 8785 / JCS", () => {
  it("localeCompare trap keys n/o/ñ produce same digest as jcs()", async () => {
    assert.equal(canonicalize(LOCALE_TRAP), jcs(LOCALE_TRAP));
    const [fromCanon, fromJcs] = await Promise.all([
      sha256Hex(canonicalize(LOCALE_TRAP)),
      sha256Hex(jcs(LOCALE_TRAP)),
    ]);
    assert.equal(fromCanon, fromJcs);
    assert.equal(canonicalize(LOCALE_TRAP), '{"n":1,"o":3,"ñ":2}');
  });

  it("shuffled keys same hash", async () => {
    const obj = { z: 1, a: 2, m: 3, n: 4, ñ: 5, o: 6 };
    const shuffled = shuffleKeys(obj, 42);
    assert.equal(canonicalize(obj), canonicalize(shuffled));
    assert.equal(canonicalize(obj), jcs(shuffled));
    const [a, b] = await Promise.all([
      sha256Hex(canonicalize(obj)),
      sha256Hex(canonicalize(shuffled)),
    ]);
    assert.equal(a, b);
  });

  it("sha256Hex still works", async () => {
    const hex = await sha256Hex("hello");
    assert.match(hex, /^[0-9a-f]{64}$/);
    assert.equal(
      hex,
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("café decomposed vs composed produce the same digest", async () => {
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    assert.notEqual(composed, decomposed);
    const a = { note: composed };
    const b = { note: decomposed };
    assert.equal(canonicalize(a), jcs(b));
    assert.equal(jcs(a), jcs(b));
    const [fromComposed, fromDecomposed, fromJcs] = await Promise.all([
      sha256Hex(canonicalize(a)),
      sha256Hex(canonicalize(b)),
      sha256Hex(jcs(a)),
    ]);
    assert.equal(fromComposed, fromDecomposed);
    assert.equal(fromComposed, fromJcs);
  });
});
