import { describe, expect, it } from "vitest";

import { UuidV7IdGenerator } from "../domain/id";
import { entityIdSchema, trimmedStringSchema, validate } from "./index";

describe("validation primitives", () => {
  it("validates and brands UUIDv7 identifiers", () => {
    const id = new UuidV7IdGenerator().next();
    const result = validate(entityIdSchema, id);

    expect(result).toEqual({ ok: true, value: id });
  });

  it("returns a typed validation error for invalid input", () => {
    const result = validate(trimmedStringSchema("Name", 8), "   ");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.issues[0]?.message).toBe("Name is required.");
      expect(result.error.cause).toBeInstanceOf(Error);
    }
  });

  it("normalizes valid strings", () => {
    expect(validate(trimmedStringSchema("Name", 8), "  Hafiza ")).toEqual({
      ok: true,
      value: "Hafiza",
    });
  });
});
