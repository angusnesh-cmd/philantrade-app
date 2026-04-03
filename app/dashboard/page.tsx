'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const router = useRouter()
  const [shelter, setShelter] = useState<any>(null)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: shelterData } = await supabase
      .from('shelters')
      .select('*')
      .eq('email', user.email)
      .single()

    if (!shelterData) {
      router.push('/login')
      return
    }

    setShelter(shelterData)

    const { data: pendingData } = await supabase
      .from('pending_amounts')
      .select('amount_usdt')
      .eq('shelter_id', shelterData.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (pendingData && pendingData.length > 0) {
      setPendingAmount(pendingData[0].amount_usdt)
    }

    const { data: reportsData } = await supabase
      .from('reports')
      .select('*')
      .eq('shelter_id', shelterData.id)
      .order('created_at', { ascending: false })

    if (reportsData) setReports(reportsData)
    setLoading(false)
  }

  async function submitReport() {
    if (!description) {
      alert('Введите описание')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.from('reports').insert({
      shelter_id: shelter?.id,
      amount_usdt: pendingAmount,
      description,
      photos: [],
      video: null,
      status: 'pending'
    })

    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      alert('Отчёт отправлен на проверку!')
      window.location.reload()
    }
    setSubmitting(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Загрузка...</div>
  if (!shelter) return null

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
        <button onClick={logout} style={{ float: 'right', background: '#e2e8f0', border: 'none', padding: '8px 16px', borderRadius: '40px', cursor: 'pointer' }}>Выйти</button>
        <h2>{shelter.name}</h2>
        <p>{shelter.email}</p>
      </div>

      <div style={{ background: 'white', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
        <h3>К отчёту сейчас</h3>
        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#1e3a5f' }}>{pendingAmount} USDT</div>
      </div>

      <div style={{ background: 'white', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
        <h3>Новый отчёт</h3>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="На что потратили средства?"
          style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '16px', marginBottom: '16px' }}
        />
        <button
          onClick={submitReport}
          disabled={submitting}
          style={{ background: '#1e3a5f', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '40px', cursor: 'pointer' }}
        >
          {submitting ? 'Отправляем...' : 'Отправить отчёт'}
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '24px', padding: '24px' }}>
        <h3>История отчётов</h3>
        {reports.length === 0 && <p>Пока нет отчётов</p>}
        {reports.map((r) => (
          <div key={r.id} style={{ borderBottom: '1px solid #edf2f7', padding: '16px 0' }}>
            <strong>{r.amount_usdt} USDT</strong> — {r.status === 'pending' ? 'На проверке' : r.status === 'approved' ? 'Опубликован' : 'Отклонён'}
            <p>{r.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}