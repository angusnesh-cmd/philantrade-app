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
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
  const [formData, setFormData] = useState({
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
      
      const adminEmail = 'angusnesh@gmail.com';
      if (session.user.email === adminEmail) {
        router.push('/admin');
        return;
      }

      const { data: shelterData } = await supabase
        .from('shelters')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setShelter(shelterData);
      
      await loadAllData(shelterData.id);
      
      setLoading(false);
    };
    
    checkUser();
  }, [router]);

  const loadAllData = async (shelterId) => {
    await loadDistributions(shelterId);
    await loadReports(shelterId);
  };

  // ЗАГРУЖАЕМ ТОЛЬКО НЕПОДТВЕРЖДЁННЫЕ РАСПРЕДЕЛЕНИЯ
  const loadDistributions = async (shelterId) => {
    const { data: distData, error: distError } = await supabase
      .from('distributions')
      .select('*')
      .eq('shelter_id', shelterId)
      .eq('is_processed', false)  // 👈 КЛЮЧЕВОЙ МОМЕНТ: только неподтверждённые
      .order('date', { ascending: false });
    
    if (distError) {
      console.error('Ошибка загрузки распределений:', distError);
      return;
    }
    
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
  };

  const loadReports = async (shelterId) => {
    const { data: reportsData } = await supabase
      .from('reports')
      .select('*')
      .eq('shelter_id', shelterId)
      .order('created_at', { ascending: false });
    
    setReports(reportsData || []);
  };

  const toggleDate = (date) => {
    setSelectedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const getSelectedTotal = () => {
    let total = 0;
    for (const date of selectedDates) {
      const group = groupedDistributions.find(g => g.date === date);
      if (group) {
        total += group.total_amount;
      }
    }
    return total;
  };

  const getSelectedIds = () => {
    const ids = [];
    for (const date of selectedDates) {
      const group = groupedDistributions.find(g => g.date === date);
      if (group) {
        group.distributions.forEach(d => ids.push(d.id));
      }
    }
    return ids;
  };

  const uploadPhotos = async (files, shelterId) => {
    const urls = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `shelter_${shelterId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(filePath, file);
      
      if (uploadError) throw new Error(`Ошибка загрузки фото: ${uploadError.message}`);
      
      const { data: urlData } = supabase.storage
        .from('reports')
        .getPublicUrl(filePath);
      
      urls.push(urlData.publicUrl);
    }
    
    return urls;
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData({ ...formData, photos: files });
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
      setUploadingPhotos(true);
      const photoUrls = formData.photos.length > 0 
        ? await uploadPhotos(formData.photos, shelter.id)
        : [];
      setUploadingPhotos(false);
      
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
          report_photos: photoUrls,
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
      setFormData({ description: '', photos: [] });
      
      // Обновляем shelter.amount_due
      const { data: freshShelter } = await supabase
        .from('shelters')
        .select('*')
        .eq('id', shelter.id)
        .single();
      
      if (freshShelter) {
        setShelter(freshShelter);
      }
      
      // Обновляем списки
      await loadDistributions(shelter.id);
      await loadReports(shelter.id);
      
      alert(`✅ Отчёт на сумму ${totalAmount.toFixed(2)} USDT отправлен на проверку!`);
      
    } catch (error) {
      console.error('Ошибка:', error);
      alert(`❌ Ошибка: ${error.message}`);
    } finally {
      setSubmitting(false);
      setUploadingPhotos(false);
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
        <h2>💰 Сумма к отчёту: {shelter.amount_due?.toFixed(2) || 0} USDT</h2>
      </div>
      
      {/* Список дней с поступлениями */}
      {groupedDistributions.length > 0 ? (
        <div style={{ marginBottom: 30 }}>
          <h3>📋 Поступления, требующие отчёта</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupedDistributions.map(group => {
              const isSelected = selectedDates.includes(group.date);
              
              return (
                <div 
                  key={group.date}
                  onClick={() => toggleDate(group.date)}
                  style={{
                    border: `2px solid ${isSelected ? '#10b981' : '#ddd'}`,
                    background: isSelected ? '#f0fdf4' : 'white',
                    padding: 15,
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
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
                    {isSelected && (
                      <div style={{ background: '#10b981', color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>
                        ✓ Выбран
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
                Общая сумма отчёта: {selectedTotal.toFixed(2)} USDT
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#fef3c7', padding: 15, borderRadius: 10, marginBottom: 20 }}>
          <p>✅ У вас нет поступлений, требующих отчёта. Все средства подтверждены!</p>
        </div>
      )}
      
      {/* Форма отправки отчёта */}
      {groupedDistributions.length > 0 && (
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
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 500 }}>Фото (можно выбрать несколько)</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                style={{ width: '100%', padding: 8 }}
              />
              <small style={{ color: '#666', display: 'block', marginTop: 5 }}>
                Поддерживаются форматы: JPG, PNG, GIF, WEBP
              </small>
              {formData.photos.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 14, color: '#10b981' }}>
                  ✅ Выбрано фото: {formData.photos.length}
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    {formData.photos.map((photo, idx) => (
                      <div key={idx} style={{ textAlign: 'center' }}>
                        <img 
                          src={URL.createObjectURL(photo)} 
                          alt="preview" 
                          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                        />
                        <div style={{ fontSize: 10, color: '#666' }}>{photo.name.slice(0, 15)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              type="submit" 
              disabled={submitting || selectedDates.length === 0}
              style={{ 
                background: selectedDates.length === 0 ? '#ccc' : '#0070f3', 
                color: 'white', 
                padding: '12px 24px', 
                border: 'none', 
                borderRadius: 5,
                fontSize: 16,
                cursor: selectedDates.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {uploadingPhotos ? '⏳ Загрузка фото...' : submitting ? 'Отправка...' : `Отправить отчёт на ${selectedTotal.toFixed(2)} USDT`}
            </button>
          </form>
        </div>
      )}
      
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
