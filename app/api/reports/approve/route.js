import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const formData = await req.formData()
  const reportId = formData.get('reportId')
  
  // Обновляем статус отчёта
  const { error } = await supabaseAdmin
    .from('reports')
    .update({ status: 'approved' })
    .eq('id', reportId)
  
  if (error) {
    return NextResponse.json({ error: 'Ошибка публикации' }, { status: 500 })
  }
  
  return NextResponse.redirect(new URL('/admin?success=true', req.url))
}