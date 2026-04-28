'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shelter, setShelter] = useState(null);
  const [groupedDistributions, setGroupedDistributions] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  
  const [formData, setFormData] = useState({
    description: '',
    photoUrls: []
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/');
        return;
      }

      setUser(session.user);
      
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
      
      // Загружаем НЕПОДТВЕРЖДЁННЫЕ распределения (is_processed = false)
      const { data: distData } = await supabase
        .from('distributions')
        .select('*')
        .eq('shelter_id', session.user.id)
        .eq('is_processed', false)
        .order('date', { ascending: true });
      
      // Группируем по дате
      const grouped = {};
      distData?.forEach(d => {
        const date = d.date || new Date(d.created_at).toISOString().split('T')[0];
        if (!grouped[date]) {
          grouped[date] = {
            date: date,
            total_amount: 0,
            count: 0,
            distributions: []
          };
        }
        grouped[date].total_amount += d.amount;
        grouped[date].count++;
        grouped[date].distributions.push(d);
      });
      
      const groupedArray = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
      setGroupedDistributions(groupedArray);
      
      // Загружаем историю отчётов
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

  const toggleDate = (date) => {
    setSelectedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const getSelectedTotal = () => {
    return groupedDistributions
      .filter(g => selectedDates.includes(g.date))
      .reduce((sum, g) => sum + g.total_amount, 0);
  };

  const getSelectedIds = () => {
    const ids = [];
    groupedDistributions
      .filter(g => selectedDates.includes(g.date))
      .forEach(g => {
        g.distributions.forEach(d => ids.push(d.id));
      });
    return ids;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedDates.length === 0) {
      alert('Выберите хотя бы один день');
      return;
    }
    
    if (!formData.description.trim()) {
      alert('Введите описание расходов');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const selectedIds = getSelectedIds();
      const totalAmount = getSelectedTotal();
      
      // Создаём отчёт
      const { error: insertError } = await supabase
        .from('reports')
        .insert({
          shelter_id: shelter.id,
          distribution_ids: selectedIds,
          total_amount: totalAmount,
          report_text: formData.description,
          report_photos: formData.photoUrls,
          status: 'pending'
        });
      
      if (insertError) throw insertError;
      
      // Обновляем статус распределений
      const { error: updateError } = await supabase
        .from('distributions')
        .update({ is_processed: true })
        .in('id', selectedIds);
      
      if (updateError) console.error('Ошибка обновления:', updateError);
      
      // Очищаем форму
      setSelectedDates([]);
      setFormData({ description: '', photoUrls: [] });
      
      // Обновляем данные
      const { data: distData } = await supabase
        .from('distributions')
        .select('*')
        .eq('shelter_id', shelter.id)
        .eq('is_processed', false)
        .order('date', { ascending: true });
      
      const grouped = {};
      distData?.forEach(d => {
        const date = d.date || new Date(d.created_at).toISOString().split('T')[0];
        if (!grouped[date]) {
          grouped[date] = {
            date: date,
            total_amount: 0,
            count: 0,
            distributions: []
          };
        }
        grouped[date].total_amount += d.amount;
        grouped[date].count++;
        grouped[date].distributions.push(d);
      });
      
      setGroupedDistributions(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
      
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .eq('shelter_id', shelter.id)
        .order('created_at', { ascending: false });
      
      setReports(reportsData || []);
      
      alert(`✅ Отчёт на сумму ${totalAmount} USDT отправлен на проверку!`);
      
    } catch (error) {
      console.error('Ошибка:', error);
      alert(`❌ Ошибка: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

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

  const selectedTotal = getSelectedTotal();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
      <h1>🏠 Личный кабинет приюта</h1>
      <p><strong>Название:</strong> {shelter.name}</p>
      
      <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 10, margin: '20px 0' }}>
        <h2>💰 Сумма к отчёту: {shelter.amount_due || 0} USDT</h2>
      </div>
      
      {/* Группированные поступления */}
      {groupedDistributions.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <h3>📋 Поступления по дням</h3>
          <p style={{ color: '#666', marginBottom: 10 }}>
            Выберите дни, которые хотите объединить в один отчёт
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupedDistributions.map(group => (
              <div 
                key={group.date}
                onClick={() => toggleDate(group.date)}
                style={{
                  border: selectedDates.includes(group.date) ? '2px solid #10b981' : '1px solid #ddd',
                  background: selectedDates.includes(group.date) ? '#f0fdf4' : 'white',
                  padding: 15,
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: 16 }}>
                      📅 {new Date(group.date).toLocaleDateString('ru-RU')}
                    </strong>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
                      {group.count} поступлений
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#10b981' }}>
                    {group.total_amount.toFixed(2)} USDT
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {selectedDates.length > 0 && (
            <div style={{ 
              background: '#e6f7e6', 
              padding: 15, 
              borderRadius: 10, 
              marginTop: 15,
              textAlign: 'center'
            }}>
              <strong>✅ Выбрано дней: {selectedDates.length}</strong>
              <br />
              <span style={{ fontSize: 18, color: '#10b981' }}>
                Общая сумма отчёта: {selectedTotal} USDT
              </span>
            </div>
          )}
        </div>
      )}
      
      {groupedDistributions.length === 0 && (
        <div style={{ background: '#fef3c7', padding: 15, borderRadius: 10, marginBottom: 20 }}>
          <p>✅ У вас нет неподтверждённых поступлений. Все средства подтверждены!</p>
        </div>
      )}
      
      {/* Форма отправки отчёта */}
      <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 10 }}>
        <h2>📤 Загрузить новый отчёт</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 500 }}>Описание расходов</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Опишите, на что были потрачены средства за выбранные дни..."
              rows={4}
              required
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 5 }}
            />
          </div>
          
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 500 }}>
              Ссылки на фото (через запятую)
            </label>
            <input
              type="text"
              placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
              value={formData.photoUrls.join(', ')}
              onChange={(e) => setFormData({ 
                ...formData, 
                photoUrls: e.target.value.split(',').map(url => url.trim()).filter(url => url) 
              })}
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 5 }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={submitting || groupedDistributions.length === 0 || selectedDates.length === 0}
            style={{ 
              background: (groupedDistributions.length === 0 || selectedDates.length === 0) ? '#ccc' : '#0070f3', 
              color: 'white', 
              padding: '12px 24px', 
              border: 'none', 
              borderRadius: 5,
              fontSize: 16,
              cursor: (groupedDistributions.length === 0 || selectedDates.length === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Отправка...' : `Отправить отчёт на ${selectedTotal} USDT`}
          </button>
        </form>
      </div>
      
      {/* История отчётов */}
      {reports.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h3>📋 История отчётов</h3>
          {reports.map(report => (
            <div key={report.id} style={{ border: '1px solid #eee', padding: 15, borderRadius: 10, marginBottom: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 'bold' }}>
                  {report.total_amount?.toFixed(2)} USDT
                </span>
                <span style={{ 
                  padding: '2px 10px', 
                  borderRadius: 20, 
                  fontSize: 12,
                  background: report.status === 'approved' ? '#10b981' : report.status === 'rejected' ? '#ef4444' : '#f59e0b',
                  color: 'white'
                }}>
                  {report.status === 'approved' ? '✅ Одобрен' : report.status === 'rejected' ? '❌ Отклонён' : '⏳ На проверке'}
                </span>
              </div>
              <p style={{ margin: '10px 0', color: '#666' }}>{report.report_text}</p>
              {report.report_photos && report.report_photos.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {report.report_photos.slice(0, 3).map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="фото" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 5 }} />
                    </a>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>
                {new Date(report.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <button 
        onClick={() => supabase.auth.signOut()} 
        style={{ marginTop: 40, padding: '8px 16px', cursor: 'pointer' }}
      >
        Выйти
      </button>
    </div>
  );
}
