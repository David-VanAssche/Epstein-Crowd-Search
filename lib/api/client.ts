// lib/api/client.ts
// Client-side API helpers that unwrap the { data, error, meta } response envelope.

/** Fetch from our API and unwrap the { data, error } envelope. Throws on error. */
export async function fetchApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(json.error || `Request failed: ${res.status}`)
  }
  return json.data as T
}

/** Fetch paginated data from our API. Returns data array + pagination meta. */
export async function fetchPaginated<T>(url: string, init?: RequestInit): Promise<{
  items: T[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}> {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok || json.error) {
    throw new Error(json.error || `Request failed: ${res.status}`)
  }
  return {
    items: json.data as T[],
    total: json.meta?.total ?? 0,
    page: json.meta?.page ?? 1,
    per_page: json.meta?.per_page ?? 20,
    has_more: json.meta?.has_more ?? false,
  }
}
