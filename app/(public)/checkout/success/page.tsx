'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mb-6 flex justify-center">
        <div className="rounded-full bg-green-500/10 p-4">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
      </div>
      <h1 className="mb-3 text-3xl font-bold">Thank You</h1>
      <p className="mb-2 text-muted-foreground">
        Your contribution has been received. Every dollar goes directly to
        processing documents and making them searchable.
      </p>
      <p className="mb-8 text-sm text-muted-foreground">
        You will receive a receipt at the email you provided during checkout.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href="/funding">See Your Impact</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to Archive</Link>
        </Button>
      </div>
      {sessionId && (
        <p className="mt-6 text-xs text-muted-foreground">
          Reference: {sessionId.slice(0, 20)}...
        </p>
      )}
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-green-500/10 p-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
        </div>
        <h1 className="mb-3 text-3xl font-bold">Thank You</h1>
        <p className="text-muted-foreground">Loading details...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
