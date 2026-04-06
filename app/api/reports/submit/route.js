import { supabase, supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }
  
  const formData = await req.formData()
  const amount = formData.get('amount')
  const description = formData.get('description')
  const photo = formData.get('photo')
  
  // Загружаем фото в Storage
  const fileExt = photo.name.split('.').pop()
  const fileName = `${user.id}/${Date.now()}.${fileExt}`
  
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('reports')
    .upload(fileName, photo, {
      cacheControl: '3600',
      upsert: false
    })
  
  if (uploadError) {
    return NextResponse.json({ error: 'Ошибка загрузки фото' }, { status: 500 })
  }
  
  // Получаем публичный URL
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('reports')
    .getPublicUrl(fileName)
  
  // Сохраняем отчёт
  const { error: insertError } = await supabaseAdmin
    .from('reports')
    .insert({
      shelter_id: user.id,
      amount: parseInt(amount),
      description: description,
      photo_url: publicUrl,
      status: 'pending'
    })
  
  if (insertError) {
    return NextResponse.json({ error: 'Ошибка сохранения отчёта' }, { status: 500 })
  }
  
  return NextResponse.redirect(new URL('/dashboard?success=true', req.url))
}