import rateLimit from 'express-rate-limit';

/**
 * Phase 4 (Priority 4.1) — Per-user + per-IP rate limit for issue submissions.
 * Limit: MAX_ISSUES_PER_HOUR (env var, default 5) per hour.
 * Returns 429 with Retry-After header when exceeded.
 */
const MAX_SUBMISSIONS = parseInt(process.env.MAX_ISSUES_PER_HOUR || '5', 10);

export const submissionRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: MAX_SUBMISSIONS,
  standardHeaders: true,   // Return RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Rate-limit by authenticated userId when available, fallback to IP
    const userId = req.user?._id?.toString();
    return userId || req.ip || 'unknown';
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: `Too many issue submissions. You may submit at most ${MAX_SUBMISSIONS} issues per hour. Please wait before submitting again.`,
    });
  },
});
