'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminPage() {
  const router = useRouter();
  const [pendingReports, setPendingReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/');
        return;
      }
      
      const adminEmail = 'ТВОЙ_EMAIL@example.com'; // ✏️ ЗАМЕНИ!
      
      if (session.user.email !== adminEmail) {
        router.push('/dashboard');
        return;
      }
      
      // Загружаем отчёты на проверку
      const { data } = await supabase
        .from('reports')
        .select('*, shelters(name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      setPendingReports(data || []);
      setLoading(false);
    };
    
    checkAdmin();
  }, [router]);

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: 100 }}>⏳ Загрузка...</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1>👑 Админ-панель</h1>
      <h2>⏳ На проверке ({pendingReports.length})</h2>
      
      {pendingReports.map(report => (
        <div key={report.id} style={{ border: '1px solid #ccc', padding: 15, marginBottom: 15 }}>
          <p><strong>Приют:</strong> {report.shelters?.email}</p>
          <p><strong>Сумма:</strong> {report.amount} ₽</p>
          <p><strong>Описание:</strong> {report.description}</p>
          {report.photo_url && <a href={report.photo_url} target="_blank">📷 Фото</a>}
          
          <form action="/api/reports/approve" method="POST">
            <input type="hidden" name="reportId" value={report.id} />
            <button type="submit">✅ Опубликовать</button>
          </form>
        </div>
      ))}
      
      <button onClick={() => supabase.auth.signOut()}>Выйти</button>
    </div>
  );
}
