import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'

async function isAdmin() {
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = 'angusnesh@gmail.com' 
  
  return user?.email === adminEmail
}

export default async function AdminPage() {
  const admin = await isAdmin()
  
  if (!admin) {
    return redirect('/dashboard') // Не админ - в дашборд
  }
  
  // Получаем отчёты на проверке
  const { data: pendingReports } = await supabase
    .from('reports')
    .select(`
      *,
      shelters (name, email)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  
  // Получаем опубликованные
  const { data: approvedReports } = await supabase
    .from('reports')
    .select(`
      *,
      shelters (name, email)
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(20)
  
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1>👑 Админ-панель</h1>
      
      <div style={{ background: '#fff3cd', padding: 20, borderRadius: 10, marginBottom: 30 }}>
        <h2>⏳ На проверке ({pendingReports?.length || 0})</h2>
        {pendingReports?.length === 0 && <p>Нет отчётов на проверке</p>}
        
        {pendingReports?.map(report => (
          <div key={report.id} style={{ border: '1px solid #ffc107', padding: 15, marginBottom: 15, borderRadius: 8, background: '#fff' }}>
            <p><strong>🏢 Приют:</strong> {report.shelters?.name || report.shelters?.email}</p>
            <p><strong>💰 Сумма:</strong> {report.amount} ₽</p>
            <p><strong>📝 Описание:</strong> {report.description}</p>
            <p><strong>📅 Дата:</strong> {new Date(report.created_at).toLocaleString('ru')}</p>
            {report.photo_url && (
              <div>
                <a href={report.photo_url} target="_blank">📷 Посмотреть фото</a>
                <br />
                <img src={report.photo_url} alt="Фото отчёта" style={{ maxWidth: 300, marginTop: 10, border: '1px solid #ddd', borderRadius: 5 }} />
              </div>
            )}
            
            <form action="/api/reports/approve" method="POST" style={{ marginTop: 15 }}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" style={{ background: '#28a745', color: 'white', padding: '8px 20px', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                ✅ Опубликовать
              </button>
            </form>
          </div>
        ))}
      </div>
      
      <div>
        <h2>✅ Опубликованные отчёты</h2>
        {approvedReports?.map(report => (
          <div key={report.id} style={{ border: '1px solid #ddd', padding: 15, marginBottom: 10, borderRadius: 8, background: '#f9f9f9' }}>
            <p><strong>Приют:</strong> {report.shelters?.name || report.shelters?.email}</p>
            <p><strong>Сумма:</strong> {report.amount} ₽</p>
            <p><strong>Описание:</strong> {report.description}</p>
            <p><strong>Дата:</strong> {new Date(report.created_at).toLocaleString('ru')}</p>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <a href="/dashboard" style={{ color: '#0070f3' }}>← Вернуться в кабинет</a>
      </div>
    </div>
  )
}
