import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }
  
  // Перенаправляем на главную, которая отправит админа в /admin, а приюта в /dashboard
  return NextResponse.redirect('https://philantrade-app.vercel.app/')
}
