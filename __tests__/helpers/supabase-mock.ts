// Mock Supabase client factory with fluent chain API
import { vi } from 'vitest'

export interface MockQueryResult {
  data: unknown
  error: unknown
  count?: number
}

/**
 * Creates a mock Supabase client with chainable query builder.
 * Every method returns the chain, and terminal methods (single, maybeSingle, etc.)
 * resolve with the configured result.
 */
export function createMockSupabaseClient(defaultResult: MockQueryResult = { data: null, error: null }) {
  let currentResult = { ...defaultResult }

  const queryBuilder: Record<string, ReturnType<typeof vi.fn>> = {}

  const terminalMethods = ['single', 'maybeSingle'] as const
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
    'match', 'not', 'or', 'filter',
    'order', 'limit', 'range', 'offset',
    'textSearch',
    'csv', 'geojson', 'explain',
    'rollback', 'returns',
    'throwOnError',
  ] as const

  // Terminal methods return the result as a promise
  for (const method of terminalMethods) {
    queryBuilder[method] = vi.fn().mockImplementation(() => Promise.resolve(currentResult))
  }

  // Chain methods return the builder itself, but also act as thenables (promise-like)
  for (const method of chainMethods) {
    queryBuilder[method] = vi.fn().mockImplementation(() => chain)
  }

  // The chain is both the query builder and a thenable
  const chain = {
    ...queryBuilder,
    then: (resolve: (value: MockQueryResult) => void, reject?: (reason: unknown) => void) => {
      return Promise.resolve(currentResult).then(resolve, reject)
    },
  }

  const rpcFn = vi.fn().mockImplementation(() => chain)

  const authMock = {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
  }

  const storageMock = {
    from: vi.fn().mockReturnValue({
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.storage/file.pdf' } }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      upload: vi.fn().mockResolvedValue({ data: { path: 'test/file.pdf' }, error: null }),
    }),
  }

  const client = {
    from: vi.fn().mockImplementation(() => chain),
    rpc: rpcFn,
    auth: authMock,
    storage: storageMock,
    // Utility to set the next result
    __setResult: (result: Partial<MockQueryResult>) => {
      currentResult = { ...defaultResult, ...result }
    },
    __setResults: (results: MockQueryResult[]) => {
      let callIndex = 0
      const originalFrom = client.from
      client.from = vi.fn().mockImplementation((...args: unknown[]) => {
        if (callIndex < results.length) {
          currentResult = results[callIndex++]
        }
        return originalFrom(...args)
      }) as typeof originalFrom
    },
  }

  return client
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
