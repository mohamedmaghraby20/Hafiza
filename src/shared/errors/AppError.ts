export abstract class AppError extends Error {
  abstract readonly code: string;

  protected constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";

  constructor(
    message: string,
    readonly issues: readonly ValidationIssue[],
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";

  constructor(resource: string, id: string, options?: ErrorOptions) {
    super(`${resource} '${id}' was not found.`, options);
  }
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
