import { describe, expect, it } from "vitest";

import { FixedClock } from "./clock";
import { isEntityId, UuidV7IdGenerator } from "./id";
import { failure, mapResult, success } from "./result";

describe("UuidV7IdGenerator", () => {
  it("creates unique UUIDv7 entity identifiers", () => {
    const generator = new UuidV7IdGenerator();
    const first = generator.next();
    const second = generator.next();

    expect(isEntityId(first)).toBe(true);
    expect(isEntityId(second)).toBe(true);
    expect(second).not.toBe(first);
  });

  it("rejects identifiers that are not UUIDv7", () => {
    expect(isEntityId("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isEntityId("not-an-id")).toBe(false);
  });
});

describe("FixedClock", () => {
  it("always returns the configured instant without exposing mutable state", () => {
    const instant = new Date("2026-09-04T08:00:00.000Z");
    const clock = new FixedClock(instant);
    const firstReading = clock.now();

    firstReading.setUTCFullYear(2030);

    expect(clock.now()).toEqual(instant);
  });
});

describe("Result", () => {
  it("maps successful values", () => {
    expect(mapResult(success(2), (value) => value * 2)).toEqual(success(4));
  });

  it("preserves failures", () => {
    const result = failure("failed");

    expect(mapResult(result, () => "unreachable")).toBe(result);
  });
});
