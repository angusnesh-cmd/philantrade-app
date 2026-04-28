'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [shelter, setShelter] = useState(null);
  const [distributions, setDistributions] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Состояние формы
  const [formData, setFormData] = useState({
    selectedIds: [],      // массив выбранных distribution_id
    description: '',
    photos: []
  });

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
      
      // Загружаем неподтверждённые распределения (is_processed = false)
      const { data: distData } = await supabase
        .from('distributions')
        .select('*')
        .eq('shelter_id', session.user.id)
        .eq('is_processed', false)
        .order('created_at', { ascending: false });
      
      setDistributions(distData || []);
      
      // Загружаем существующие отчёты (с полем distribution_ids)
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .eq('shelter_id', session.user.id)
        .order('created_at', { ascending: false });
      
      // Для каждого отчёта получаем суммы распределений
      const reportsWithDetails = await Promise.all((reportsData || []).map(async (report) => {
        if (report.distribution_ids && report.distribution_ids.length > 0) {
          const { data: dists } = await supabase
            .from('distributions')
            .select('amount')
            .in('id', report.distribution_ids);
          
          const totalAmount = dists?.reduce((sum, d) => sum + d.amount, 0) || 0;
          return { ...report, total_amount: totalAmount };
        }
        return { ...report, total_amount: 0 };
      }));
      
      setReports(reportsWithDetails || []);
      setLoading(false);
    };
    
    checkUser();
  }, [router]);

  // Рассчитываем общую сумму выбранных поступлений
  const getSelectedTotal = () => {
    return distributions
      .filter(d => formData.selectedIds.includes(d.id))
      .reduce((sum, d) => sum + d.amount, 0);
  };

  const toggleDistribution = (id) => {
    setFormData(prev => {
      if (prev.selectedIds.includes(id)) {
        return { ...prev, selectedIds: prev.selectedIds.filter(i => i !== id) };
      } else {
        return { ...prev, selectedIds: [...prev.selectedIds, id] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.selectedIds.length === 0) {
      alert('Выберите хотя бы одно поступление, по которому хотите отчитаться');
      return;
    }
    
    if (!formData.description.trim()) {
      alert('Введите описание расходов');
      return;
    }
    
    if (formData.photos.length === 0) {
      alert('Прикрепите хотя бы одно фото');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // 1. Загружаем фото в Storage
      const photoUrls = [];
      for (const photo of formData.photos) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `shelter_${shelter.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(filePath, photo);
        
        if (uploadError) {
          throw new Error('Не удалось загрузить фото: ' + uploadError.message);
        }
        
        const { data: urlData } = supabase.storage
          .from('reports')
          .getPublicUrl(filePath);
        
        photoUrls.push(urlData.publicUrl);
      }
      
      // 2. Создаём отчёт (с массивом distribution_ids)
      const totalAmount = getSelectedTotal();
      
      const { data: newReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          shelter_id: shelter.id,
          distribution_ids: formData.selectedIds,
          total_amount: totalAmount,
          report_text: formData.description,
          report_photos: photoUrls,
          status: 'pending'
        })
        .select()
        .single();
      
      if (insertError) {
        throw new Error('Не удалось создать отчёт: ' + insertError.message);
      }
      
      // 3. Обновляем статус ВСЕХ выбранных распределений
      const { error: updateError } = await supabase
        .from('distributions')
        .update({ is_processed: true })
        .in('id', formData.selectedIds);
      
      if (updateError) {
        console.error('Ошибка обновления распределений:', updateError);
      }
      
      // 4. Очищаем форму
      setFormData({
        selectedIds: [],
        description: '',
        photos: []
      });
      
      // 5. Обновляем списки
      const { data: distData } = await supabase
        .from('distributions')
        .select('*')
        .eq('shelter_id', shelter.id)
        .eq('is_processed', false)
        .order('created_at', { ascending: false });
      
      setDistributions(distData || []);
      
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .eq('shelter_id', shelter.id)
        .order('created_at', { ascending: false });
      
      // Обновляем суммы для отчётов
      const reportsWithDetails = await Promise.all((reportsData || []).map(async (report) => {
        if (report.distribution_ids && report.distribution_ids.length > 0) {
          const { data: dists } = await supabase
            .from('distributions')
            .select('amount')
            .in('id', report.distribution_ids);
          
          const total = dists?.reduce((sum, d) => sum + d.amount, 0) || 0;
          return { ...report, total_amount: total };
        }
        return { ...report, total_amount: 0 };
      }));
      
      setReports(reportsWithDetails);
      
      alert(`✅ Отчёт на сумму ${totalAmount} USDT успешно отправлен на проверку!`);
      
    } catch (error) {
      console.error('Ошибка:', error);
      alert(`❌ Ошибка: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData({ ...formData, photos: files });
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
      <p><strong>Email:</strong> {shelter.email}</p>
      
      <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 10, margin: '20px 0' }}>
        <h2>💰 Сумма к отчёту: {shelter.amount_due || 0} USDT</h2>
      </div>
      
      {/* Список неподтверждённых поступлений */}
      {distributions.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <h3>📋 Неподтверждённые поступления</h3>
          <p style={{ color: '#666', marginBottom: 10 }}>
            Выберите одно или несколько поступлений, которые хотите объединить в один отчёт
          </p>
          
          <div style={{ border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f5f5f5' }}>
                <tr>
                  <th style={{ padding: 12, textAlign: 'left', width: 50 }}>✓</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Дата</th>
                  <th style={{ padding: 12, textAlign: 'right' }}>Сумма (USDT)</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Транзакция</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map(dist => (
                  <tr key={dist.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={formData.selectedIds.includes(dist.id)}
                        onChange={() => toggleDistribution(dist.id)}
                        style={{ width: 20, height: 20 }}
                      />
                    </td>
                    <td style={{ padding: 12 }}>
                      {new Date(dist.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 12, textAlign: 'right', fontWeight: 'bold' }}>
                      {dist.amount}
                    </td>
                    <td style={{ padding: 12, fontSize: 12, color: '#666' }}>
                      {dist.transaction_hash?.slice(0, 10)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {formData.selectedIds.length > 0 && (
            <div style={{ 
              background: '#e6f7e6', 
              padding: 15, 
              borderRadius: 10, 
              marginTop: 15,
              textAlign: 'center'
            }}>
              <strong>✅ Выбрано поступлений: {formData.selectedIds.length}</strong>
              <br />
              <span style={{ fontSize: 18, color: '#10b981' }}>
                Общая сумма отчёта: {selectedTotal} USDT
              </span>
            </div>
          )}
        </div>
      )}
      
      {distributions.length === 0 && (
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
              placeholder="Опишите, на что были потрачены средства (корм, лечение, услуги и т.д.)"
              rows={4}
              required
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 5 }}
            />
          </div>
          
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 500 }}>Фото (подтверждение)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              required
              style={{ width: '100%', padding: 8 }}
            />
            <small style={{ color: '#666', display: 'block', marginTop: 5 }}>
              Можно выбрать несколько фото. Подойдут чеки, фото товаров, процесс помощи и т.д.
            </small>
            {formData.photos.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 14, color: '#10b981' }}>
                ✅ Выбрано фото: {formData.photos.length}
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            disabled={submitting || distributions.length === 0 || formData.selectedIds.length === 0}
            style={{ 
              background: (distributions.length === 0 || formData.selectedIds.length === 0) ? '#ccc' : '#0070f3', 
              color: 'white', 
              padding: '12px 24px', 
              border: 'none', 
              borderRadius: 5,
              fontSize: 16,
              cursor: (distributions.length === 0 || formData.selectedIds.length === 0) ? 'not-allowed' : 'pointer'
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
                  {report.total_amount || report.total_amount} USDT
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
                  {report.report_photos.length > 3 && (
                    <span>+{report.report_photos.length - 3} фото</span>
                  )}
                </div>
              )}
              {report.distribution_ids && report.distribution_ids.length > 1 && (
                <div style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
                  📦 Объединённый отчёт по {report.distribution_ids.length} поступлениям
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
