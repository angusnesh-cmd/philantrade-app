'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shelter, setShelter] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/');
        return;
      }

      setUser(session.user);
      
      // Проверка на админа
      const adminEmail = 'angusnesh@gmail.com';
      
      if (session.user.email === adminEmail) {
        router.push('/admin');
        return;
      }

      // Загружаем данные приюта
      const { data: shelterData } = await supabase
        .from('shelters')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setShelter(shelterData);
      
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .eq('shelter_id', session.user.id)
        .order('created_at', { ascending: false });
      
      setReports(reportsData || []);
      setLoading(false);
    };
    
    checkUser();
  }, [router]);

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: 100 }}>⏳ Загрузка...</div>;
  }

  if (!shelter) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <h1>⏳ Доступ настраивается</h1>
        <p>Ваш аккаунт ещё не активирован.</p>
        <button onClick={() => supabase.auth.signOut()}>Выйти</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1>🏠 Личный кабинет приюта</h1>
      <p><strong>Название:</strong> {shelter.name}</p>
      <p><strong>Email:</strong> {shelter.email}</p>
      
      <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 10, margin: '20px 0' }}>
        <h2>💰 Сумма к отчёту: {shelter.amount_due || 0} ₽</h2>
      </div>
      
      {/* Форма отправки отчёта */}
      <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 10 }}>
        <h2>📤 Загрузить новый отчёт</h2>
        <form action="/api/reports/submit" method="POST" encType="multipart/form-data">
          <input type="number" name="amount" placeholder="Сумма" required style={{ width: '100%', marginBottom: 10, padding: 8 }} />
          <textarea name="description" placeholder="Описание" rows={4} required style={{ width: '100%', marginBottom: 10, padding: 8 }} />
          <input type="file" name="photo" accept="image/*" required style={{ marginBottom: 10 }} />
          <button type="submit" style={{ background: '#0070f3', color: 'white', padding: '10px 20px', border: 'none', borderRadius: 5 }}>Отправить</button>
        </form>
      </div>
      
      <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 40, padding: '8px 16px' }}>Выйти</button>
    </div>
  );
}
