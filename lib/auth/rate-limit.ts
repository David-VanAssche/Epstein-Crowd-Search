// lib/auth/rate-limit.ts
import { rateLimited } from '@/lib/api/responses'

/**
 * Simple in-memory rate limiter.
 * For production, replace with Redis-backed solution (Upstash, etc.)
 *
 * In-memory maps are cleared on server restart, which is acceptable
 * for early development. Each serverless function instance has its
 * own map, so limits are per-instance, not global.
 */

interface RateLimitEntry {
  count: number
  reset_at: number // Unix timestamp in ms
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitMap) {
      if (entry.reset_at < now) {
        rateLimitMap.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  /** Unique identifier prefix for the limit bucket (e.g., 'chat', 'search') */
  prefix: string
  /** Maximum number of requests allowed in the window */
  max_requests: number
  /** Window duration in seconds */
  window_seconds: number
}

export const RATE_LIMITS = {
  chat_free: { prefix: 'chat_free', max_requests: 20, window_seconds: 86400 } as RateLimitConfig,
  chat_paid: { prefix: 'chat_paid', max_requests: 200, window_seconds: 86400 } as RateLimitConfig,
  search: { prefix: 'search', max_requests: 60, window_seconds: 60 } as RateLimitConfig,
  proposal: { prefix: 'proposal', max_requests: 10, window_seconds: 3600 } as RateLimitConfig,
  vote: { prefix: 'vote', max_requests: 100, window_seconds: 3600 } as RateLimitConfig,
  annotation: { prefix: 'annotation', max_requests: 30, window_seconds: 3600 } as RateLimitConfig,
  general: { prefix: 'general', max_requests: 120, window_seconds: 60 } as RateLimitConfig,
} as const

/**
 * Check rate limit for a given identifier.
 *
 * @param identifier - User ID or IP address
 * @param config - Rate limit configuration
 * @returns null if within limits, or a Response with 429 status
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Response | null {
  const key = `${config.prefix}:${identifier}`
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || entry.reset_at < now) {
    rateLimitMap.set(key, {
      count: 1,
      reset_at: now + config.window_seconds * 1000,
    })
    return null
  }

  if (entry.count >= config.max_requests) {
    const retryAfterSeconds = Math.ceil((entry.reset_at - now) / 1000)
    const response = rateLimited(
      `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`
    )
    response.headers.set('Retry-After', String(retryAfterSeconds))
    response.headers.set('X-RateLimit-Limit', String(config.max_requests))
    response.headers.set('X-RateLimit-Remaining', '0')
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.reset_at / 1000)))
    return response
  }

  entry.count++
  return null
}

/**
 * Get the client's IP address from the request headers.
 * Works behind Vercel, Cloudflare, and standard proxies.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP
  return '127.0.0.1'
}
