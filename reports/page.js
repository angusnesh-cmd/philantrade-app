'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [shelters, setShelters] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalReports: 0, totalAmount: 0 });

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    
    // Загружаем одобренные отчёты
    const { data: reportsData } = await supabase
      .from('reports')
      .select('*')
      .eq('status', 'approved')
      .order('published_at', { ascending: false })
      .limit(50);
    
    setReports(reportsData || []);
    
    // Загружаем информацию о приютах
    const shelterIds = [...new Set(reportsData?.map(r => r.shelter_id) || [])];
    if (shelterIds.length > 0) {
      const { data: sheltersData } = await supabase
        .from('shelters')
        .select('id, name, wallet_address')
        .in('id', shelterIds);
      
      const shelterMap = {};
      sheltersData?.forEach(s => { shelterMap[s.id] = s; });
      setShelters(shelterMap);
    }
    
    // Статистика
    const totalAmount = reportsData?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;
    setStats({
      totalReports: reportsData?.length || 0,
      totalAmount: totalAmount
    });
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <h2>⏳ Загрузка отчётов...</h2>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      {/* Шапка */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1>📋 Отчёты о помощи животным</h1>
        <p style={{ color: '#666' }}>
          Здесь публикуются отчёты приютов о том, как были потрачены полученные средства
        </p>
        
        {/* Статистика */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 30, 
          marginTop: 20,
          padding: 20,
          background: '#f5f5f5',
          borderRadius: 15
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981' }}>
              {stats.totalReports}
            </div>
            <div style={{ fontSize: 14, color: '#666' }}>отчётов</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981' }}>
              {stats.totalAmount.toFixed(2)} USDT
            </div>
            <div style={{ fontSize: 14, color: '#666' }}>подтверждено</div>
          </div>
        </div>
      </div>

      {/* Список отчётов */}
      {reports.length === 0 && (
        <div style={{ textAlign: 'center', padding: 50, background: '#fef3c7', borderRadius: 15 }}>
          <h3>📭 Пока нет опубликованных отчётов</h3>
          <p>Отчёты появятся здесь после проверки администратором</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {reports.map(report => {
          const shelter = shelters[report.shelter_id];
          
          return (
            <div key={report.id} style={{
              border: '1px solid #e0e0e0',
              borderRadius: 20,
              overflow: 'hidden',
              background: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              {/* Шапка карточки */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '20px 25px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>🏠 {shelter?.name || 'Приют'}</h2>
                    {shelter?.wallet_address && (
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 5, fontFamily: 'monospace' }}>
                        {shelter.wallet_address.slice(0, 10)}...{shelter.wallet_address.slice(-8)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                      {report.total_amount?.toFixed(2)} USDT
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      📅 {new Date(report.published_at || report.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Тело карточки */}
              <div style={{ padding: 25 }}>
                {/* Описание */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>📝 Отчёт</h3>
                  <p style={{ lineHeight: 1.6, color: '#555', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {report.report_text}
                  </p>
                </div>

                {/* Фото */}
                {report.report_photos && report.report_photos.length > 0 && (
                  <div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>📷 Фото</h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                      gap: 15 
                    }}>
                      {report.report_photos.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ display: 'block' }}
                        >
                          <img 
                            src={url} 
                            alt={`Фото отчёта ${idx + 1}`} 
                            style={{
                              width: '100%',
                              height: 200,
                              objectFit: 'cover',
                              borderRadius: 10,
                              border: '1px solid #e0e0e0'
                            }}
                            onError={(e) => {
                              e.target.src = 'https://placehold.co/400x200?text=Фото+не+загрузилось';
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Доп. информация */}
                <div style={{ 
                  marginTop: 20, 
                  paddingTop: 15, 
                  borderTop: '1px solid #f0f0f0',
                  fontSize: 12,
                  color: '#999',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10
                }}>
                  <span>✅ Отчёт проверен и подтверждён</span>
                  <span>🔗 <a href={`https://philantrade.com/report/${report.id}`} style={{ color: '#667eea' }}>Постоянная ссылка</a></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Футер */}
      <div style={{ textAlign: 'center', marginTop: 40, padding: 20, color: '#999', fontSize: 12 }}>
        <p>© Philantrade — прозрачная благотворительность на блокчейне</p>
      </div>
    </div>
  );
}
