// Request factory helpers for API route testing
import { NextRequest } from 'next/server'

/**
 * Create a GET request with optional search params.
 * Returns NextRequest so `.nextUrl.searchParams` works in route handlers.
 */
export function createGetRequest(
  url: string,
  params?: Record<string, string>,
  headers?: Record<string, string>
): NextRequest {
  const urlObj = new URL(url, 'http://localhost:3000')
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      urlObj.searchParams.set(key, value)
    }
  }
  return new NextRequest(urlObj.toString(), {
    method: 'GET',
    headers: new Headers(headers),
  })
}

/**
 * Create a POST request with JSON body.
 */
export function createPostRequest(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000').toString(), {
    method: 'POST',
    headers: new Headers({
      'Content-Type': 'application/json',
      ...headers,
    }),
    body: JSON.stringify(body),
  })
}

/**
 * Create a PATCH request with JSON body.
 */
export function createPatchRequest(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000').toString(), {
    method: 'PATCH',
    headers: new Headers({
      'Content-Type': 'application/json',
      ...headers,
    }),
    body: JSON.stringify(body),
  })
}

/**
 * Create a DELETE request.
 */
export function createDeleteRequest(
  url: string,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000').toString(), {
    method: 'DELETE',
    headers: new Headers(headers),
  })
}

/**
 * Parse a NextResponse body as JSON.
 */
export async function parseResponseBody<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}
