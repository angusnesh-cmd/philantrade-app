import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'

async function getUserData(userId) {
  const { data: shelter } = await supabase
    .from('shelters')
    .select('amount_due, name')
    .eq('id', userId)
    .single()
  
  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('shelter_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
  
  return { shelter, reports }
}

export default async function Dashboard() {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return redirect('https://ваш-сайт.tilda.ws/login')
  }
  
  const { shelter, reports } = await getUserData(user.id)
  
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1>Личный кабинет приюта</h1>
      <p>Email: {user.email}</p>
      <p>Название: {shelter?.name || 'Не указано'}</p>
      
      <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 10, margin: '20px 0' }}>
        <h2>💰 Сумма к отчёту: {shelter?.amount_due || 0} ₽</h2>
      </div>
      
      <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 10 }}>
        <h2>Загрузить новый отчёт</h2>
        <form action="/api/reports/submit" method="POST" encType="multipart/form-data">
          <div style={{ marginBottom: 15 }}>
            <label>Потраченная сумма (₽):</label><br />
            <input type="number" name="amount" required style={{ width: '100%', padding: 8 }} />
          </div>
          
          <div style={{ marginBottom: 15 }}>
            <label>Описание трат:</label><br />
            <textarea name="description" rows="4" required style={{ width: '100%', padding: 8 }} />
          </div>
          
          <div style={{ marginBottom: 15 }}>
            <label>Фото чека/отчёта:</label><br />
            <input type="file" name="photo" accept="image/*" required />
          </div>
          
          <button type="submit" style={{ background: '#0070f3', color: 'white', padding: '10px 20px', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
            Отправить на проверку
          </button>
        </form>
      </div>
      
      <div style={{ marginTop: 30 }}>
        <h2>Мои предыдущие отчёты</h2>
        {reports.length === 0 && <p>Пока нет отчётов</p>}
        {reports.map(report => (
          <div key={report.id} style={{ border: '1px solid #eee', padding: 15, marginBottom: 10, borderRadius: 8 }}>
            <p><strong>Сумма:</strong> {report.amount} ₽</p>
            <p><strong>Статус:</strong> {report.status === 'approved' ? '✅ Опубликован' : '⏳ На проверке'}</p>
            <p><strong>Описание:</strong> {report.description}</p>
            {report.photo_url && <a href={report.photo_url} target="_blank">📷 Посмотреть фото</a>}
          </div>
        ))}
      </div>
      
      <form action="/api/logout" method="POST" style={{ marginTop: 40 }}>
        <button type="submit" style={{ background: '#ccc', padding: '8px 16px', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
          Выйти
        </button>
      </form>
    </div>
  )
}