/**
 * Simple in-memory rate limiter for lead submissions.
 * Production: consider Redis or a service like Upstash.
 * 
 * For now: in-memory map of IP -> [ timestamp, timestamp, ... ]
 * Keeps last N requests, drops old ones outside the window.
 */

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 5,        // 5 requests per minute per IP
};

// Global store: IP -> timestamps
const store = new Map<string, number[]>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of store.entries()) {
    // Keep only timestamps within the window
    const recent = timestamps.filter(t => now - t < DEFAULT_CONFIG.windowMs);
    if (recent.length === 0) {
      store.delete(ip);
    } else {
      store.set(ip, recent);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request from this IP should be rate-limited.
 * Returns: { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const timestamps = store.get(ip) ?? [];
  
  // Remove timestamps outside the window
  const recent = timestamps.filter(t => now - t < config.windowMs);
  
  const allowed = recent.length < config.maxRequests;
  if (allowed) {
    recent.push(now);
  }
  
  store.set(ip, recent);
  
  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - recent.length),
    resetAt: recent.length > 0 ? recent[0]! + config.windowMs : now + config.windowMs,
  };
}

/**
 * Extract IP from request headers.
 * Checks X-Forwarded-For (Vercel/proxy), X-Real-IP, then defaults to '127.0.0.1'.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]!.trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback (won't have real IP in local dev without proxy)
  return '127.0.0.1';
}
