import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  success,
  paginated,
  error,
  unauthorized,
  forbidden,
  notFound,
  rateLimited,
  serverError,
  handleApiError,
} from '@/lib/api/responses'
import { ZodError } from 'zod'

async function parseBody(response: Response) {
  return response.json()
}

describe('success', () => {
  it('returns 200 with data envelope', async () => {
    const res = success({ id: 1, name: 'test' })
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data).toEqual({ id: 1, name: 'test' })
    expect(body.error).toBeNull()
  })

  it('includes optional meta', async () => {
    const res = success('ok', { count: 5 })
    const body = await parseBody(res)
    expect(body.meta).toEqual({ count: 5 })
  })

  it('returns null data as null', async () => {
    const res = success(null)
    const body = await parseBody(res)
    expect(body.data).toBeNull()
  })
})

describe('paginated', () => {
  it('returns paginated response with meta', async () => {
    const res = paginated([1, 2, 3], 1, 10, 25)
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.data).toEqual([1, 2, 3])
    expect(body.meta.page).toBe(1)
    expect(body.meta.per_page).toBe(10)
    expect(body.meta.total).toBe(25)
    expect(body.meta.has_more).toBe(true)
  })

  it('has_more is false when at last page', async () => {
    const res = paginated([1], 3, 10, 25)
    const body = await parseBody(res)
    expect(body.meta.has_more).toBe(false)
  })

  it('has_more is false when exactly at boundary', async () => {
    const res = paginated([1], 1, 10, 10)
    const body = await parseBody(res)
    expect(body.meta.has_more).toBe(false)
  })
})

describe('error', () => {
  it('returns 400 by default', async () => {
    const res = error('Bad input')
    expect(res.status).toBe(400)
    const body = await parseBody(res)
    expect(body.data).toBeNull()
    expect(body.error).toBe('Bad input')
  })

  it('accepts custom status code', async () => {
    const res = error('Conflict', 409)
    expect(res.status).toBe(409)
  })
})

describe('unauthorized', () => {
  it('returns 401 with default message', async () => {
    const res = unauthorized()
    expect(res.status).toBe(401)
    const body = await parseBody(res)
    expect(body.error).toBe('Authentication required')
  })

  it('accepts custom message', async () => {
    const res = unauthorized('Please log in')
    const body = await parseBody(res)
    expect(body.error).toBe('Please log in')
  })
})

describe('forbidden', () => {
  it('returns 403 with default message', async () => {
    const res = forbidden()
    expect(res.status).toBe(403)
    const body = await parseBody(res)
    expect(body.error).toBe('Forbidden')
  })
})

describe('notFound', () => {
  it('returns 404 with default message', async () => {
    const res = notFound()
    expect(res.status).toBe(404)
    const body = await parseBody(res)
    expect(body.error).toBe('Not found')
  })
})

describe('rateLimited', () => {
  it('returns 429 with default message', async () => {
    const res = rateLimited()
    expect(res.status).toBe(429)
    const body = await parseBody(res)
    expect(body.error).toBe('Rate limit exceeded')
  })
})

describe('serverError', () => {
  it('returns 500 with default message', async () => {
    const res = serverError()
    expect(res.status).toBe(500)
    const body = await parseBody(res)
    expect(body.error).toBe('Internal server error')
  })
})

describe('handleApiError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('handles ZodError -> 400 with field paths', async () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['query'],
        message: 'Expected string, received number',
      },
    ])
    const res = handleApiError(zodError)
    expect(res.status).toBe(400)
    const body = await parseBody(res)
    expect(body.error).toContain('query')
    expect(body.error).toContain('Validation error')
  })

  it('handles ZodError with nested paths', async () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['filters', 'dataset_id'],
        message: 'Required',
      },
    ])
    const res = handleApiError(zodError)
    const body = await parseBody(res)
    expect(body.error).toContain('filters.dataset_id')
  })

  it('handles Error -> 500 with dev message', async () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const res = handleApiError(new Error('DB connection failed'))
    expect(res.status).toBe(500)
    const body = await parseBody(res)
    expect(body.error).toBe('DB connection failed')
    process.env.NODE_ENV = original
  })

  it('handles Error -> 500 with generic message in production', async () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const res = handleApiError(new Error('DB connection failed'))
    expect(res.status).toBe(500)
    const body = await parseBody(res)
    expect(body.error).toBe('Internal server error')
    process.env.NODE_ENV = original
  })

  it('handles unknown error -> 500', async () => {
    const res = handleApiError('string error')
    expect(res.status).toBe(500)
    const body = await parseBody(res)
    expect(body.error).toBe('Internal server error')
  })

  it('logs errors to console', () => {
    handleApiError(new Error('test'))
    expect(console.error).toHaveBeenCalled()
  })
})
