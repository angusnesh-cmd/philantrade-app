'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const checkAuth = () => {
    if (password === 'admin') {
      setAuthenticated(true)
      loadReports()
    } else if (password) {
      alert('Неверный пароль')
    }
  }

  async function loadReports() {
    const { data } = await supabase
      .from('reports')
      .select(`
        *,
        shelters (name, wallet_address)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (data) setReports(data)
    setLoading(false)
  }

  async function approveReport(id: number) {
    const { error } = await supabase
      .from('reports')
      .update({ status: 'approved', published_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      setReports(reports.filter(r => r.id !== id))
    }
  }

  async function rejectReport(id: number) {
    const { error } = await supabase
      .from('reports')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      setReports(reports.filter(r => r.id !== id))
    }
  }

  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '24px' }}>
          <h2>Вход в админку</h2>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" style={{ width: '100%', padding: '12px', margin: '16px 0', border: '1px solid #ccc', borderRadius: '16px' }} />
          <button onClick={checkAuth} style={{ background: '#1e3a5f', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '40px', cursor: 'pointer' }}>Войти</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <h1>Админка Philantrade</h1>
      <p>Отчёты на модерации: {reports.length}</p>

      {loading && <p>Загрузка...</p>}

      {reports.map((report) => (
        <div key={report.id} style={{ background: 'white', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
          <h3>{report.shelters.name}</h3>
          <p><strong>Сумма:</strong> {report.amount_usdt} USDT</p>
          <p><strong>Описание:</strong> {report.description}</p>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button onClick={() => approveReport(report.id)} style={{ background: '#1e7b48', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '40px', cursor: 'pointer' }}>Опубликовать</button>
            <button onClick={() => rejectReport(report.id)} style={{ background: '#c23d1c', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '40px', cursor: 'pointer' }}>Отклонить</button>
          </div>
        </div>
      ))}
    </div>
  )
}