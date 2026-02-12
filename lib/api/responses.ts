// lib/api/responses.ts
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
  meta?: Record<string, unknown>
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  meta: {
    page: number
    per_page: number
    total: number
    has_more: boolean
  }
}

export function success<T>(data: T, meta?: Record<string, unknown>): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null, meta })
}

export function paginated<T>(
  data: T[],
  page: number,
  per_page: number,
  total: number
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    data,
    error: null,
    meta: {
      page,
      per_page,
      total,
      has_more: page * per_page < total,
    },
  })
}

export function error(message: string, status: number = 400): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status })
}

export function unauthorized(message: string = 'Authentication required'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 401 })
}

export function forbidden(message: string = 'Forbidden'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 403 })
}

export function notFound(message: string = 'Not found'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 404 })
}

export function rateLimited(message: string = 'Rate limit exceeded'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 429 })
}

export function serverError(message: string = 'Internal server error'): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message }, { status: 500 })
}

export function handleApiError(err: unknown): NextResponse<ApiResponse<null>> {
  if (err instanceof ZodError) {
    const messages = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
    return error(`Validation error: ${messages.join(', ')}`, 400)
  }

  if (err instanceof Error) {
    console.error('[API Error]', err.message, err.stack)
    return serverError(
      process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    )
  }

  console.error('[API Error] Unknown error:', err)
  return serverError()
}
