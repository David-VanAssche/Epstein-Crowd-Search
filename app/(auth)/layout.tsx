import { createClient } from '@/lib/supabase/server'
import { AuthGateOverlay } from './AuthGateOverlay'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm">{children}</div>
        <AuthGateOverlay />
      </div>
    )
  }

  return <>{children}</>
}
