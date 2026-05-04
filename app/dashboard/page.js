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

      // Загружаем приют
      const { data: shelterData, error: shelterError } = await supabase
        .from('shelters')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (shelterError) {
        console.error('Ошибка загрузки приюта:', shelterError);
        setLoading(false);
        return;
      }
      
      setShelter(shelterData);
      
      // После установки shelter, загружаем всё остальное
      await loadAllData(shelterData.id);
      
      setLoading(false);
    };
    
    checkUser();
  }, [router]);

  const loadAllData = async (shelterId) => {
    await loadDistributions(shelterId);
    await loadReports(shelterId);
  };

  const loadDistributions = async (shelterId) => {
    const { data: distData, error: distError } = await supabase
      .from('distributions')
      .select('*')
      .eq('shelter_id', shelterId)
      .order('date', { ascending: false });
    
    if (distError) {
      console.error('Ошибка загрузки распределений:', distError);
      return;
    }
    
    console.log('Загружено распределений:', distData?.length || 0);
    
    // Группируем по дате
    const grouped = {};
    distData?.forEach(d => {
      const date = d.date || new Date(d.created_at).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = {
          date: date,
          total_amount: 0,
          count: 0,
          processed_count: 0,
          distributions: []
        };
      }
      grouped[date].total_amount += d.amount;
      grouped[date].count++;
      if (d.is_processed) grouped[date].processed_count++;
      grouped[date].distributions.push(d);
    });
    
    const groupedArray = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
    console.log('Сгруппировано дней:', groupedArray.length);
    setGroupedDistributions(groupedArray);
  };

  const loadReports = async (shelterId) => {
    const { data: reportsData, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('shelter_id', shelterId)
      .order('created_at', { ascending: false });
    
    if (reportsError) {
      console.error('Ошибка загрузки отчётов:', reportsError);
      return;
    }
    
    setReports(reportsData || []);
  };

  const toggleDate = (date) => {
    const group = groupedDistributions.find(g => g.date === date);
    const hasUnprocessed = group && group.processed_count < group.count;
    
    if (!hasUnprocessed) return;
    
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
        const unprocessedAmount = group.total_amount * (group.count - group.processed_count) / group.count;
        total += unprocessedAmount;
      }
    }
    return total;
  };

  const getSelectedIds = () => {
    const ids = [];
    for (const date of selectedDates) {
      const group = groupedDistributions.find(g => g.date === date);
      if (group) {
        group.distributions
          .filter(d => !d.is_processed)
          .forEach(d => ids.push(d.id));
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
      
      if (selectedIds.length === 0) {
        alert('Нет неподтверждённых поступлений в выбранные дни');
        return;
      }
      
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
      
      // ОБНОВЛЯЕМ ДАННЫЕ — сначала обновляем shelter.amount_due
      const { data: freshShelter } = await supabase
        .from('shelters')
        .select('*')
        .eq('id', shelter.id)
        .single();
      
      if (freshShelter) {
        setShelter(freshShelter);
      }
      
      // Обновляем распределения и отчёты
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

  const getDayStatus = (group) => {
    if (group.processed_count === 0 && group.count > 0) return 'unprocessed';
    if (group.processed_count === group.count) return 'processed';
    return 'partial';
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
  const hasUnprocessedDistributions = groupedDistributions.some(g => g.processed_count < g.count);

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
          <h3>📋 Поступления по дням</h3>
          <p style={{ color: '#666', marginBottom: 10 }}>
            ✅ Зелёный — всё подтверждено | 🟡 Жёлтый — частично | ⚪ Белый — требует отчёта
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupedDistributions.map(group => {
              const status = getDayStatus(group);
              const isSelected = selectedDates.includes(group.date);
              const hasUnprocessed = status !== 'processed';
              
              let bgColor = 'white';
              let borderColor = '#ddd';
              
              if (status === 'processed') {
                bgColor = '#f0fdf4';
                borderColor = '#10b981';
              } else if (status === 'partial') {
                bgColor = '#fefce8';
                borderColor = '#eab308';
              }
              
              return (
                <div 
                  key={group.date}
                  onClick={() => hasUnprocessed && toggleDate(group.date)}
                  style={{
                    border: `2px solid ${isSelected ? '#10b981' : borderColor}`,
                    background: isSelected ? '#f0fdf4' : bgColor,
                    padding: 15,
                    borderRadius: 10,
                    cursor: hasUnprocessed ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    opacity: !hasUnprocessed ? 0.7 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <strong style={{ fontSize: 16 }}>
                        📅 {new Date(group.date).toLocaleDateString('ru-RU')}
                      </strong>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
                        {group.count} поступлений
                        {status === 'processed' && <span style={{ color: '#10b981', marginLeft: 8 }}>✅ Все подтверждены</span>}
                        {status === 'partial' && <span style={{ color: '#eab308', marginLeft: 8 }}>🟡 {group.processed_count}/{group.count} подтверждено</span>}
                        {status === 'unprocessed' && <span style={{ color: '#f59e0b', marginLeft: 8 }}>⏳ Требует отчёта</span>}
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
                    {!hasUnprocessed && (
                      <div style={{ background: '#10b981', color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>
                        ✓ Готово
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
          <p>📭 У вас пока нет поступлений. Когда средства поступят, они появятся здесь.</p>
        </div>
      )}
      
      {/* Форма отправки отчёта */}
      {hasUnprocessedDistributions && (
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
