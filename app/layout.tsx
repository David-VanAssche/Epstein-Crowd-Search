import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: {
    default: 'Epstein Crowd Research',
    template: '%s | Epstein Crowd Research',
  },
  description:
    '3.5 million pages of Epstein files, now searchable. AI-powered search, entity mapping, and crowdsourced redaction solving.',
  openGraph: {
    title: 'Epstein Crowd Research',
    description: '3.5 million pages of truth, now searchable.',
    url: 'https://epsteincrowdresearch.com',
    siteName: 'Epstein Crowd Research',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
