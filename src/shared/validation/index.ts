import { z } from "zod";

import type { EntityId } from "../domain/id";
import { UUID_V7_PATTERN } from "../domain/id";
import { ValidationError } from "../errors/AppError";
import { failure, success, type Result } from "../domain/result";

export const entityIdSchema = z
  .string()
  .regex(UUID_V7_PATTERN, "Must be a valid UUIDv7 identifier.")
  .transform((value): EntityId => value as EntityId);

export function trimmedStringSchema(fieldName: string, maximumLength: number) {
  return z
    .string()
    .trim()
    .min(1, `${fieldName} is required.`)
    .max(
      maximumLength,
      `${fieldName} must be at most ${maximumLength} characters.`,
    );
}

export function validate<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T, ValidationError> {
  const result = schema.safeParse(input);

  if (result.success) {
    return success(result.data);
  }

  return failure(
    new ValidationError(
      "The supplied data is invalid.",
      result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
      { cause: result.error },
    ),
  );
}
