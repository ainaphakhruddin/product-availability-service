import type { NextFunction, Request, Response } from "express";
import { AppError, NotFoundError } from "../errors";

interface ErrorBody {
  error: { code: string; message: string; requestId?: string };
}

/** 404 for any route that is not defined (distinct code from PRODUCT_NOT_FOUND). */
export function notFoundRoute(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`, "ROUTE_NOT_FOUND"));
}

/**
 * Single place that turns errors into HTTP responses.
 * - Known AppErrors keep their status/code and are logged at warn.
 * - Anything else becomes a generic 500: the stack is logged, never returned to
 *   the caller (no internal details leak).
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = String(req.id ?? "");

  if (err instanceof AppError) {
    req.log.warn({ code: err.code, status: err.status }, err.message);
    const body: ErrorBody = { error: { code: err.code, message: err.message, requestId } };
    res.status(err.status).json(body);
    return;
  }

  req.log.error({ err }, "unhandled error");
  const body: ErrorBody = {
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
  };
  res.status(500).json(body);
}
