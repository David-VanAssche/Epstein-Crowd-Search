import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ChatFAB } from '@/components/chat/ChatFAB'
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
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <ChatFAB />
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}
