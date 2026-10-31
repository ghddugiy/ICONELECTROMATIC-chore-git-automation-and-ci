const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_MAX_CLIENTS = 10000;

export function resolveClientIp(req) {
  return req?.ip || req?.socket?.remoteAddress || "unknown";
}

export function normalizeEmail(email) {
  if (typeof email !== "string") {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function createAttemptLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  maxClients = DEFAULT_MAX_CLIENTS,
  now = Date.now,
} = {}) {
  const attemptsByClient = new Map();
  let requestsSincePrune = 0;

  function pruneExpired(currentTime) {
    for (const [client, bucket] of attemptsByClient) {
      if (bucket.resetAt <= currentTime) {
        attemptsByClient.delete(client);
      }
    }
  }

  function getBucket(clientKey, currentTime) {
    let bucket = attemptsByClient.get(clientKey);
    if (!bucket || bucket.resetAt <= currentTime) {
      return null;
    }
    return bucket;
  }

  return {
    consume(clientKey) {
      const currentTime = now();
      requestsSincePrune += 1;
      if (requestsSincePrune >= 256) {
        pruneExpired(currentTime);
        requestsSincePrune = 0;
      }

      let bucket = attemptsByClient.get(clientKey);

      if (!bucket || bucket.resetAt <= currentTime) {
        if (attemptsByClient.size >= maxClients) {
          return {
            allowed: false,
            retryAfterSeconds: Math.ceil(windowMs / 1000),
          };
        }

        bucket = {
          count: 0,
          resetAt: currentTime + windowMs,
        };
        attemptsByClient.set(clientKey, bucket);
      }

      if (bucket.count >= maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((bucket.resetAt - currentTime) / 1000)
          ),
        };
      }

      bucket.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },

    isBlocked(clientKey) {
      if (!clientKey) {
        return { blocked: false, retryAfterSeconds: 0 };
      }
      const currentTime = now();
      const bucket = getBucket(clientKey, currentTime);
      if (!bucket || bucket.count < maxAttempts) {
        return { blocked: false, retryAfterSeconds: 0 };
      }
      return {
        blocked: true,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - currentTime) / 1000)
        ),
      };
    },

    recordFailure(clientKey) {
      if (!clientKey) {
        return { allowed: true, retryAfterSeconds: 0 };
      }
      const currentTime = now();
      requestsSincePrune += 1;
      if (requestsSincePrune >= 256) {
        pruneExpired(currentTime);
        requestsSincePrune = 0;
      }

      let bucket = attemptsByClient.get(clientKey);
      if (!bucket || bucket.resetAt <= currentTime) {
        if (attemptsByClient.size >= maxClients) {
          return {
            allowed: false,
            retryAfterSeconds: Math.ceil(windowMs / 1000),
          };
        }

        bucket = {
          count: 0,
          resetAt: currentTime + windowMs,
        };
        attemptsByClient.set(clientKey, bucket);
      }

      bucket.count += 1;

      if (bucket.count > maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((bucket.resetAt - currentTime) / 1000)
          ),
        };
      }

      return { allowed: true, retryAfterSeconds: 0 };
    },

    reset(clientKey) {
      if (clientKey) {
        attemptsByClient.delete(clientKey);
      }
    },

    getCount(clientKey) {
      const bucket = getBucket(clientKey, now());
      return bucket ? bucket.count : 0;
    },
  };
}

export function createLoginRateLimitMiddleware({
  ipLimiter = createAttemptLimiter({
    windowMs: DEFAULT_WINDOW_MS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
  }),
  emailLimiter = createAttemptLimiter({
    windowMs: DEFAULT_WINDOW_MS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
  }),
  resolveIp = resolveClientIp,
} = {}) {
  const middleware = function loginRateLimit(req, res, next) {
    const clientIp = resolveIp(req);
    const targetEmail = normalizeEmail(req?.body?.email);

    // 1. Check if the IP has exceeded failure threshold
    const ipStatus = ipLimiter.isBlocked(clientIp);
    if (ipStatus.blocked) {
      res.set("Retry-After", String(ipStatus.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: "Too many login attempts from this IP. Please try again later.",
      });
    }

    // 2. Check if the account/email has exceeded failure threshold
    if (targetEmail) {
      const emailStatus = emailLimiter.isBlocked(targetEmail);
      if (emailStatus.blocked) {
        res.set("Retry-After", String(emailStatus.retryAfterSeconds));
        return res.status(429).json({
          success: false,
          message: "Too many failed login attempts for this account. Please try again later.",
        });
      }
    }

    // Attach security hooks for the route handler to report outcome
    req.loginSecurity = {
      recordFailure(email) {
        ipLimiter.recordFailure(clientIp);
        const resolvedEmail = normalizeEmail(email || targetEmail);
        if (resolvedEmail) {
          emailLimiter.recordFailure(resolvedEmail);
        }
      },
      recordSuccess(email) {
        // Reset the IP login-failure counter only after successful authentication
        ipLimiter.reset(clientIp);
        const resolvedEmail = normalizeEmail(email || targetEmail);
        if (resolvedEmail) {
          emailLimiter.reset(resolvedEmail);
        }
      },
    };

    return next();
  };

  middleware.ipLimiter = ipLimiter;
  middleware.emailLimiter = emailLimiter;

  return middleware;
}

export const defaultIpLimiter = createAttemptLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
});

export const defaultEmailLimiter = createAttemptLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
});

const defaultLoginRateLimit = createLoginRateLimitMiddleware({
  ipLimiter: defaultIpLimiter,
  emailLimiter: defaultEmailLimiter,
});

export default defaultLoginRateLimit;
