// app/(auth)/layout.tsx
// Auth-required pages. For now, just pass through.
// Phase 4 will add auth check + redirect to /login.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
