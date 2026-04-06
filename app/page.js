import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export default async function Home() {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  }
  
  return (
    <div style={{ textAlign: 'center', marginTop: 100 }}>
      <h1>Система отчётов для приютов</h1>
      <p>Войдите через <a href="https://philantrade.com/login">страницу входа на Tilda</a></p>
    </div>
  )
}
