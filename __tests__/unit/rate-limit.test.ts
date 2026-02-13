import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need fresh module state for each test, so we use dynamic imports
let checkRateLimit: typeof import('@/lib/auth/rate-limit').checkRateLimit
let getClientIP: typeof import('@/lib/auth/rate-limit').getClientIP
let RATE_LIMITS: typeof import('@/lib/auth/rate-limit').RATE_LIMITS

describe('rate-limit', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    // Re-import to get fresh rateLimitMap
    const mod = await import('@/lib/auth/rate-limit')
    checkRateLimit = mod.checkRateLimit
    getClientIP = mod.getClientIP
    RATE_LIMITS = mod.RATE_LIMITS
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkRateLimit', () => {
    const config = { prefix: 'test', max_requests: 3, window_seconds: 60 }

    it('allows first request', () => {
      expect(checkRateLimit('user1', config)).toBeNull()
    })

    it('allows requests within limit', () => {
      checkRateLimit('user1', config)
      checkRateLimit('user1', config)
      expect(checkRateLimit('user1', config)).toBeNull() // 3rd of 3
    })

    it('blocks request exceeding limit', () => {
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user1', config)
      }
      const response = checkRateLimit('user1', config)
      expect(response).not.toBeNull()
      expect(response!.status).toBe(429)
    })

    it('sets Retry-After header', async () => {
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user1', config)
      }
      const response = checkRateLimit('user1', config)!
      const retryAfter = response.headers.get('Retry-After')
      expect(retryAfter).toBeTruthy()
      expect(parseInt(retryAfter!)).toBeGreaterThan(0)
      expect(parseInt(retryAfter!)).toBeLessThanOrEqual(60)
    })

    it('sets X-RateLimit-* headers', async () => {
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user1', config)
      }
      const response = checkRateLimit('user1', config)!
      expect(response.headers.get('X-RateLimit-Limit')).toBe('3')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
    })

    it('resets after window expires', () => {
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user1', config)
      }
      // Should be blocked now
      expect(checkRateLimit('user1', config)).not.toBeNull()

      // Advance past window
      vi.advanceTimersByTime(61 * 1000)

      // Should allow again
      expect(checkRateLimit('user1', config)).toBeNull()
    })

    it('isolates different prefixes', () => {
      const configA = { prefix: 'a', max_requests: 1, window_seconds: 60 }
      const configB = { prefix: 'b', max_requests: 1, window_seconds: 60 }

      checkRateLimit('user1', configA)
      // A is exhausted, B should still work
      expect(checkRateLimit('user1', configA)).not.toBeNull()
      expect(checkRateLimit('user1', configB)).toBeNull()
    })

    it('isolates different identifiers', () => {
      const oneShot = { prefix: 'x', max_requests: 1, window_seconds: 60 }
      checkRateLimit('user1', oneShot)
      // user1 exhausted, user2 should still work
      expect(checkRateLimit('user1', oneShot)).not.toBeNull()
      expect(checkRateLimit('user2', oneShot)).toBeNull()
    })

    it('returns 429 body with message', async () => {
      const oneShot = { prefix: 'y', max_requests: 1, window_seconds: 60 }
      checkRateLimit('u', oneShot)
      const res = checkRateLimit('u', oneShot)!
      const body = await res.json()
      expect(body.error).toContain('Rate limit exceeded')
    })
  })

  describe('getClientIP', () => {
    it('extracts first IP from x-forwarded-for', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      })
      expect(getClientIP(req)).toBe('1.2.3.4')
    })

    it('trims whitespace from forwarded IP', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '  1.2.3.4  ' },
      })
      expect(getClientIP(req)).toBe('1.2.3.4')
    })

    it('falls back to x-real-ip', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '10.0.0.1' },
      })
      expect(getClientIP(req)).toBe('10.0.0.1')
    })

    it('defaults to 127.0.0.1', () => {
      const req = new Request('http://localhost')
      expect(getClientIP(req)).toBe('127.0.0.1')
    })

    it('prefers x-forwarded-for over x-real-ip', () => {
      const req = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.1.1.1',
          'x-real-ip': '2.2.2.2',
        },
      })
      expect(getClientIP(req)).toBe('1.1.1.1')
    })
  })

  describe('RATE_LIMITS constants', () => {
    it('has expected keys', () => {
      expect(Object.keys(RATE_LIMITS)).toEqual(
        expect.arrayContaining(['chat_free', 'chat_paid', 'search', 'proposal', 'vote', 'annotation', 'general'])
      )
    })

    it('chat_free: 20 requests per day', () => {
      expect(RATE_LIMITS.chat_free.max_requests).toBe(20)
      expect(RATE_LIMITS.chat_free.window_seconds).toBe(86400)
    })

    it('search: 60 requests per minute', () => {
      expect(RATE_LIMITS.search.max_requests).toBe(60)
      expect(RATE_LIMITS.search.window_seconds).toBe(60)
    })

    it('general: 120 requests per minute', () => {
      expect(RATE_LIMITS.general.max_requests).toBe(120)
      expect(RATE_LIMITS.general.window_seconds).toBe(60)
    })
  })
})
