import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FRAME,
  VERSION,
  encodeFrame,
  parseFrames,
  encodeReason,
  clampInt,
  REASON,
} from "./protocol.js";

test("VERSION is semver-like", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test("encode/parse roundtrip", () => {
  const payload = new TextEncoder().encode("hello");
  const frame = encodeFrame(FRAME.DATA, 7, payload);
  const [parsed] = parseFrames(frame);
  assert.equal(parsed.type, FRAME.DATA);
  assert.equal(parsed.streamId, 7);
  assert.deepEqual(Array.from(parsed.payload), Array.from(payload));
});

test("batch of frames", () => {
  const a = encodeFrame(FRAME.OPEN, 1);
  const b = encodeFrame(FRAME.CLOSE, 1);
  const batch = new Uint8Array(a.length + b.length);
  batch.set(a, 0);
  batch.set(b, a.length);
  const frames = parseFrames(batch);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].type, FRAME.OPEN);
  assert.equal(frames[1].type, FRAME.CLOSE);
});

test("reject empty batch", () => {
  assert.throws(() => parseFrames(new Uint8Array()), /empty batch/);
});

test("encodeReason truncates", () => {
  const long = "x".repeat(200);
  assert.ok(encodeReason(long).length <= 64);
  assert.deepEqual(Array.from(encodeReason(REASON.MAX_STREAMS)), Array.from(new TextEncoder().encode(REASON.MAX_STREAMS)));
});

test("clampInt bounds", () => {
  assert.equal(clampInt("3", 1, 6, 6), 3);
  assert.equal(clampInt("99", 1, 6, 6), 6);
  assert.equal(clampInt("nope", 1, 6, 6), 6);
});
