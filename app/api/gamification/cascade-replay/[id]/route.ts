// app/api/gamification/cascade-replay/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CascadeReplayParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: CascadeReplayParams) {
  const { id } = await params

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid cascade ID' }, { status: 400 })
  }

  return NextResponse.json({
    id,
    rootRedactionId: id,
    rootText: '',
    totalNodes: 0,
    totalDocuments: 0,
    nodes: [],
  })
}
