import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || 'missing',
    keyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'missing'
  })
}
