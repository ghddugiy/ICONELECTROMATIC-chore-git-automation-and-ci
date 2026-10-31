/**
 * enquiryRateLimit.js — Per-IP submission rate limiter for contact and career forms.
 *
 * Reuses the same zero-dependency createAttemptLimiter factory used by loginRateLimit,
 * so no new npm package is needed. The window and limits are more generous than login
 * (5 per 15 min) because legitimate users may resubmit to correct a typo.
 *
 * Limits (configurable via factory args in tests):
 *   - 10 submissions per IP per 30-minute window
 */

import { createAttemptLimiter } from "./loginRateLimit.js";

const WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ATTEMPTS = 10;

export function createEnquiryRateLimit({ windowMs = WINDOW_MS, maxAttempts = MAX_ATTEMPTS, now = Date.now } = {}) {
  const limiter = createAttemptLimiter({ windowMs, maxAttempts, now });

  return function enquiryRateLimit(req, res, next) {
    const clientKey = req.socket?.remoteAddress || "unknown";
    const result = limiter.consume(clientKey);

    if (!result.allowed) {
      res.set("Retry-After", String(result.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: "Too many submissions. Please wait before trying again.",
      });
    }

    return next();
  };
}

// Default singleton instance used by the production server.
export default createEnquiryRateLimit();
