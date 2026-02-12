// app/(public)/layout.tsx
// Public pages — no auth required. Just pass through children.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
