import { supabaseAdmin } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

// Проверка что это админ (по email)
async function isAdmin() {
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmails = ['tvoi-email@example.com'] // ✏️ Замени на свой email
  
  return user && adminEmails.includes(user.email)
}

export default async function AdminPage() {
  const admin = await isAdmin()
  
  if (!admin) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <h1>Доступ запрещён</h1>
        <p>У вас нет прав для просмотра этой страницы</p>
      </div>
    )
  }
  
  // Получаем все отчёты со статусом pending
  const { data: pendingReports } = await supabaseAdmin
    .from('reports')
    .select(`
      *,
      shelters (name, email)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  
  // Получаем опубликованные
  const { data: approvedReports } = await supabaseAdmin
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
      <h1>📋 Админ-панель</h1>
      
      <div style={{ background: '#fff3cd', padding: 15, borderRadius: 8, marginBottom: 30 }}>
        <h2>⏳ На проверке ({pendingReports?.length || 0})</h2>
        {pendingReports?.length === 0 && <p>Нет отчётов на проверку</p>}
        
        {pendingReports?.map(report => (
          <div key={report.id} style={{ border: '1px solid #ffc107', padding: 15, marginBottom: 15, borderRadius: 8 }}>
            <p><strong>Приют:</strong> {report.shelters?.email || report.shelter_id}</p>
            <p><strong>Сумма:</strong> {report.amount} ₽</p>
            <p><strong>Описание:</strong> {report.description}</p>
            <p><strong>Дата:</strong> {new Date(report.created_at).toLocaleString('ru')}</p>
            {report.photo_url && (
              <div>
                <a href={report.photo_url} target="_blank">📷 Посмотреть фото</a>
                <br />
                <img src={report.photo_url} alt="Фото отчёта" style={{ maxWidth: 300, marginTop: 10 }} />
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
            <p><strong>Приют:</strong> {report.shelters?.email || report.shelter_id}</p>
            <p><strong>Сумма:</strong> {report.amount} ₽</p>
            <p><strong>Описание:</strong> {report.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}