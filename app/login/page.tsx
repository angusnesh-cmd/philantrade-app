'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMagicLink() {
    if (!email) return
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    })

    if (error) {
      setMessage(`Ошибка: ${error.message}`)
    } else {
      setMessage(`✅ Ссылка отправлена на ${email}. Проверьте почту.`)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ maxWidth: '400px', width: '100%', background: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: '#1e3a5f' }}>Philantrade</h1>
          <p style={{ color: '#5b6e8c', marginTop: '8px' }}>Вход для приютов</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="priut@example.com"
            style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '16px' }}
            onKeyPress={(e) => e.key === 'Enter' && sendMagicLink()}
          />

          <button
            onClick={sendMagicLink}
            disabled={loading}
            style={{ background: '#1e3a5f', color: 'white', border: 'none', padding: '12px', borderRadius: '40px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? 'Отправляем...' : 'Отправить ссылку для входа'}
          </button>

          {message && (
            <div style={{ padding: '12px', borderRadius: '12px', fontSize: '14px', background: message.includes('✅') ? '#e6f7ee' : '#fee9e6', color: message.includes('✅') ? '#1e7b48' : '#c23d1c' }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}