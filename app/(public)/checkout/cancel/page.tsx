'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mb-6 flex justify-center">
        <div className="rounded-full bg-muted p-4">
          <XCircle className="h-12 w-12 text-muted-foreground" />
        </div>
      </div>
      <h1 className="mb-3 text-3xl font-bold">Payment Cancelled</h1>
      <p className="mb-8 text-muted-foreground">
        No worries — you have not been charged. You can try again whenever you are ready.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href="/funding">Back to Funding</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to Archive</Link>
        </Button>
      </div>
    </div>
  )
}
