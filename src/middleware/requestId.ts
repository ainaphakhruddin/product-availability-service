import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";

/**
 * Reuse the caller's X-Request-Id when it is sane (so one request can be traced
 * across services), otherwise mint one. Echoed back in the response header.
 */
export function genRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers["x-request-id"];
  const id =
    typeof incoming === "string" && /^[A-Za-z0-9-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", id);
  return id;
}
