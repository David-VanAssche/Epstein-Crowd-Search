// app/(auth)/layout.tsx
import { AuthGuard } from '@/components/shared/AuthGuard'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
