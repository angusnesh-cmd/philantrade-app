'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminPage() {
  const router = useRouter();
  const [pendingReports, setPendingReports] = useState([]);
  const [approvedReports, setApprovedReports] = useState([]);
  const [rejectedReports, setRejectedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [stats, setStats] = useState({ totalShelters: 0, totalDistributed: 0, totalApproved: 0 });

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/');
        return;
      }
      
      const adminEmail = 'angusnesh@gmail.com'; 
      
      if (session.user.email !== adminEmail) {
        router.push('/dashboard');
        return;
      }
      
      await loadData();
    };
    
    checkAdmin();
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    
    // Загружаем отчёты на проверку (pending)
    const { data: pending } = await supabase
      .from('reports')
      .select('*, shelters(name, email, wallet_address)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    // Загружаем одобренные отчёты
    const { data: approved } = await supabase
      .from('reports')
      .select('*, shelters(name, email)')
      .eq('status', 'approved')
      .order('published_at', { ascending: false })
      .limit(20);
    
    // Загружаем отклонённые отчёты
    const { data: rejected } = await supabase
      .from('reports')
      .select('*, shelters(name, email)')
      .eq('status', 'rejected')
      .order('reviewed_at', { ascending: false })
      .limit(20);
    
    // Статистика
    const { data: sheltersCount } = await supabase
      .from('shelters')
      .select('id', { count: 'exact', head: true });
    
    const { data: distributionsTotal } = await supabase
      .from('distributions')
      .select('amount');
    
    const totalDistributed = distributionsTotal?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
    
    const { data: approvedCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    setPendingReports(pending || []);
    setApprovedReports(approved || []);
    setRejectedReports(rejected || []);
    setStats({
      totalShelters: sheltersCount?.length || 0,
      totalDistributed: totalDistributed,
      totalApproved: approvedCount?.length || 0
    });
    setLoading(false);
  };

  const handleApprove = async (reportId) => {
    setProcessingId(reportId);
    
    try {
      // Получаем текущего админа
      const { data: { user } } = await supabase.auth.getUser();
      
      // Вызываем функцию approve_report
      const { data, error } = await supabase.rpc('approve_report', {
        p_report_id: reportId,
        p_admin_id: user.id
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.success) {
        alert(`✅ Отчёт одобрен! Сумма ${data.subtracted_amount} USDT списана с баланса приюта`);
        await loadData(); // Обновляем список
      } else {
        alert(`❌ Ошибка: ${data?.error}`);
      }
    } catch (error) {
      console.error('Ошибка одобрения:', error);
      alert(`❌ Ошибка: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reportId) => {
    setProcessingId(reportId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc('reject_report', {
        p_report_id: reportId,
        p_admin_id: user.id
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.success) {
        alert('❌ Отчёт отклонён');
        await loadData();
      } else {
        alert(`❌ Ошибка: ${data?.error}`);
      }
    } catch (error) {
      console.error('Ошибка отклонения:', error);
      alert(`❌ Ошибка: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <h2>⏳ Загрузка админ-панели...</h2>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h1>👑 Админ-панель Philantrade</h1>
        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Выйти
        </button>
      </div>

      {/* Статистика */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 20, 
        marginBottom: 30,
        background: '#f5f5f5',
        padding: 20,
        borderRadius: 10
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3>🏠 Приюты</h3>
          <p style={{ fontSize: 28, fontWeight: 'bold', margin: 0 }}>{stats.totalShelters}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3>💰 Распределено всего</h3>
          <p style={{ fontSize: 28, fontWeight: 'bold', margin: 0, color: '#10b981' }}>
            {stats.totalDistributed.toFixed(2)} USDT
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3>✅ Одобрено отчётов</h3>
          <p style={{ fontSize: 28, fontWeight: 'bold', margin: 0 }}>{stats.totalApproved}</p>
        </div>
      </div>

      {/* Отчёты на проверке */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ color: '#f59e0b' }}>⏳ На проверке ({pendingReports.length})</h2>
        {pendingReports.length === 0 && (
          <p style={{ color: '#666' }}>Нет отчётов на проверке</p>
        )}
        {pendingReports.map(report => (
          <div key={report.id} style={{ 
            border: '1px solid #f59e0b', 
            background: '#fffbeb',
            padding: 20, 
            borderRadius: 10, 
            marginBottom: 20 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <strong>🏠 Приют:</strong> {report.shelters?.name || '—'} 
                <span style={{ color: '#666', fontSize: 12, marginLeft: 10 }}>({report.shelters?.email})</span>
              </div>
              <div>
                <strong>💰 Сумма отчёта:</strong> <span style={{ fontWeight: 'bold', fontSize: 18, color: '#10b981' }}>
                  {report.total_amount?.toFixed(2) || '?'} USDT
                </span>
              </div>
            </div>
            
            <div style={{ marginTop: 10, padding: 10, background: '#fef3c7', borderRadius: 5 }}>
              <strong>📝 Описание:</strong>
              <p style={{ margin: '10px 0', whiteSpace: 'pre-wrap' }}>{report.report_text}</p>
            </div>
            
            {report.report_photos && report.report_photos.length > 0 && (
              <div style={{ marginTop: 15 }}>
                <strong>📷 Фото:</strong>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  {report.report_photos.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={url} 
                        alt={`фото ${idx + 1}`} 
                        style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 5, border: '1px solid #ddd' }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            {report.distribution_ids && report.distribution_ids.length > 1 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
                📦 Объединённый отчёт по {report.distribution_ids.length} поступлениям
              </div>
            )}
            
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleApprove(report.id)}
                disabled={processingId === report.id}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 5,
                  cursor: processingId === report.id ? 'not-allowed' : 'pointer',
                  opacity: processingId === report.id ? 0.5 : 1
                }}
              >
                {processingId === report.id ? '⏳ Обработка...' : '✅ Одобрить'}
              </button>
              <button
                onClick={() => handleReject(report.id)}
                disabled={processingId === report.id}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 5,
                  cursor: processingId === report.id ? 'not-allowed' : 'pointer',
                  opacity: processingId === report.id ? 0.5 : 1
                }}
              >
                {processingId === report.id ? '⏳ Обработка...' : '❌ Отклонить'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Одобренные отчёты */}
      {approvedReports.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ color: '#10b981' }}>✅ Одобренные отчёты ({approvedReports.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {approvedReports.map(report => (
              <div key={report.id} style={{ border: '1px solid #d1fae5', background: '#ecfdf5', padding: 15, borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{report.shelters?.name}</strong></span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{report.total_amount?.toFixed(2)} USDT</span>
                </div>
                <p style={{ marginTop: 10, fontSize: 14, color: '#555' }}>{report.report_text?.slice(0, 100)}...</p>
                <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>
                  {new Date(report.published_at || report.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Отклонённые отчёты */}
      {rejectedReports.length > 0 && (
        <div>
          <h2 style={{ color: '#ef4444' }}>❌ Отклонённые отчёты ({rejectedReports.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {rejectedReports.map(report => (
              <div key={report.id} style={{ border: '1px solid #fecaca', background: '#fef2f2', padding: 15, borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{report.shelters?.name}</strong></span>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{report.total_amount?.toFixed(2)} USDT</span>
                </div>
                <p style={{ marginTop: 10, fontSize: 14, color: '#555' }}>{report.report_text?.slice(0, 100)}...</p>
                <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>
                  Отклонён: {new Date(report.reviewed_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
