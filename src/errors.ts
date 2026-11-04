/**
 * Typed application errors. Each one carries the HTTP status and a stable,
 * machine-readable `code` so callers (checkout, storefront) can branch on it
 * without parsing human-readable messages.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, "INVALID_PRODUCT_ID", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = "PRODUCT_NOT_FOUND") {
    super(404, code, message);
  }
}
