import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', 'https://ваш-сайт.tilda.ws'))
}