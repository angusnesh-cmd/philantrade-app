import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  
  // Обрабатываем оба варианта: и code, и token
  const code = requestUrl.searchParams.get('code')
  const token = requestUrl.searchParams.get('token') || requestUrl.searchParams.get('token_hash')
  
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  } else if (token) {
    await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink'
    })
  }
  
  return NextResponse.redirect('https://philantrade-app.vercel.app/')
}
