import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select(`
      id,
      total_amount,
      report_text,
      report_photos,
      published_at,
      created_at,
      shelters (
        id,
        name,
        wallet_address
      )
    `)
    .eq('status', 'approved')
    .order('published_at', { ascending: false })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Возвращаем JSON с CORS заголовками для Tilda
  return NextResponse.json(reports, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

// Обработка OPTIONS запроса для CORS (preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
