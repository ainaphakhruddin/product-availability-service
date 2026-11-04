import type { Request, Response } from "express";
import type { AvailabilityService } from "../services/availabilityService";
import { validateProductId } from "../validation";

/**
 * HTTP layer only: parse and validate input, call the service, shape the
 * response. No business rules and no data access here.
 */
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  getAvailability = (req: Request, res: Response): void => {
    const productId = validateProductId(req.params.productId);

    // Callers that cannot tolerate stale data (checkout) send Cache-Control: no-cache.
    const bypassCache = /no-cache/i.test(req.get("cache-control") ?? "");

    const availability = this.service.getAvailability(productId, { bypassCache });

    // Tell CDNs / clients how long this answer may be reused.
    res.set("Cache-Control", "public, max-age=5");
    res.status(200).json(availability);
  };
}
