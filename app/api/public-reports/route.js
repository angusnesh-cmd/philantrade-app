import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select(`
      id,
      amount,
      description,
      photo_url,
      created_at,
      shelters (name)
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(reports)
}