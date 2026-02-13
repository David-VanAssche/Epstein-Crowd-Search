// app/api/gamification/achievements/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    achievements: [],
    total_available: 0,
  })
}
