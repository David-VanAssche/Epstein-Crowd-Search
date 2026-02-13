// app/api/gamification/leaderboard/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    leaderboard: [],
    total_contributors: 0,
    last_updated: new Date().toISOString(),
  })
}
