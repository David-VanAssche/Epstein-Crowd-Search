import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://4d038dfce73d722d727839271fee09ea@o4510879338463232.ingest.us.sentry.io/4510879353274368',
  tracesSampleRate: 1.0,
})
