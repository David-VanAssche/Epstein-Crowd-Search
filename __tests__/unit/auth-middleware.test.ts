import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { getUser, requireAuth, requireTier } from '@/lib/auth/middleware'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

function mockSupabase(authUser: unknown = null, authError: unknown = null, profileData: unknown = null, profileError: unknown = null) {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: authError,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: profileData,
            error: profileError,
          }),
        }),
      }),
    }),
  }
  mockCreateClient.mockResolvedValue(supabase as never)
  return supabase
}

const testUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: { name: 'Test User' },
}

describe('getUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user when authenticated', async () => {
    mockSupabase(testUser)
    const user = await getUser()
    expect(user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' },
    })
  })

  it('returns null when auth error', async () => {
    mockSupabase(null, new Error('Auth expired'))
    const user = await getUser()
    expect(user).toBeNull()
  })

  it('returns null when no user', async () => {
    mockSupabase(null, null)
    const user = await getUser()
    expect(user).toBeNull()
  })
})

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user when authenticated', async () => {
    mockSupabase(testUser)
    const result = await requireAuth()
    expect(result).not.toBeInstanceOf(Response)
    expect((result as { id: string }).id).toBe('user-123')
  })

  it('returns 401 Response when not authenticated', async () => {
    mockSupabase(null)
    const result = await requireAuth()
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })
})

describe('requireTier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user when tier meets requirement', async () => {
    mockSupabase(testUser, null, { tier: 'researcher', level: 5 })
    const result = await requireTier('researcher')
    expect(result).not.toBeInstanceOf(Response)
  })

  it('returns user when tier exceeds requirement', async () => {
    mockSupabase(testUser, null, { tier: 'admin', level: 10 })
    const result = await requireTier('contributor')
    expect(result).not.toBeInstanceOf(Response)
  })

  it('returns 403 when tier is below requirement', async () => {
    mockSupabase(testUser, null, { tier: 'contributor', level: 1 })
    const result = await requireTier('moderator')
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null)
    const result = await requireTier('admin')
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('defaults null tier to contributor', async () => {
    mockSupabase(testUser, null, { tier: null, level: 0 })
    const result = await requireTier('contributor')
    expect(result).not.toBeInstanceOf(Response)
  })

  it('defaults null tier -> fails for researcher', async () => {
    mockSupabase(testUser, null, { tier: null, level: 0 })
    const result = await requireTier('researcher')
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('handles missing profile row (null data)', async () => {
    mockSupabase(testUser, null, null)
    // null profile -> tier defaults to 'contributor'
    const result = await requireTier('contributor')
    expect(result).not.toBeInstanceOf(Response)
  })

  it('returns 401 on profile DB error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase(testUser, null, null, new Error('DB down'))
    const result = await requireTier('contributor')
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('handles full hierarchy: contributor < researcher < moderator < admin', async () => {
    const tiers = ['contributor', 'researcher', 'moderator', 'admin'] as const
    for (let i = 0; i < tiers.length; i++) {
      vi.clearAllMocks()
      mockSupabase(testUser, null, { tier: tiers[i], level: i })
      // Should pass for own tier
      const pass = await requireTier(tiers[i])
      expect(pass, `${tiers[i]} should pass for own tier`).not.toBeInstanceOf(Response)
      // Should fail for next tier (if exists)
      if (i < tiers.length - 1) {
        vi.clearAllMocks()
        mockSupabase(testUser, null, { tier: tiers[i], level: i })
        const fail = await requireTier(tiers[i + 1])
        expect(fail, `${tiers[i]} should fail for ${tiers[i + 1]}`).toBeInstanceOf(Response)
      }
    }
  })
})
