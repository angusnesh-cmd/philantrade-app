'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    const { data } = await supabase
      .from('reports')
      .select(`
        *,
        shelters (name)
      `)
      .eq('status', 'approved')
      .order('published_at', { ascending: false })

    if (data) setReports(data)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Отчёты приютов</h1>
      <p style={{ color: '#5b6e8c', marginBottom: '32px' }}>Спасибо донорам за прозрачную помощь</p>

      {loading && <p>Загрузка...</p>}

      {reports.map((report) => (
        <div key={report.id} style={{ background: 'white', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
          <h3>{report.shelters.name}</h3>
          <p><strong>{report.amount_usdt} USDT</strong></p>
          <p>{report.description}</p>
          <p style={{ fontSize: '12px', color: '#8a99b0', marginTop: '16px' }}>
            Опубликовано: {new Date(report.published_at).toLocaleDateString('ru-RU')}
          </p>
        </div>
      ))}
    </div>
  )
}