'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Проверяем, что supabase клиент инициализирован
        if (!supabase) {
          setError('Supabase client not initialized. Check environment variables in Vercel.');
          setIsProcessing(false);
          return;
        }

        const hashFragment = window.location.hash.substring(1);
        const params = new URLSearchParams(hashFragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        // Если есть access_token и это magiclink — завершаем вход
        if (accessToken && type === 'magiclink') {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error('Session error:', sessionError);
            setError(sessionError.message);
            setIsProcessing(false);
            return;
          }
          
          // Убираем фрагмент из URL и перенаправляем
          window.location.hash = '';
          router.push('/dashboard');
          return;
        }

        // Если пользователь уже вошёл, просто перенаправляем
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Get user error:', userError);
        }
        
        if (user) {
          router.push('/dashboard');
          return;
        }

        // Если ничего из вышеперечисленного — показываем страницу входа
        setIsProcessing(false);
      } catch (err) {
        console.error('Auth error:', err);
        setError(err.message);
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [router]);

  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100, color: 'red' }}>
        <h1>❌ Ошибка входа</h1>
        <p>{error}</p>
        <p>Пожалуйста, проверьте:</p>
        <ul style={{ textAlign: 'left', display: 'inline-block' }}>
          <li>Переменные окружения в Vercel: <code>NEXT_PUBLIC_SUPABASE_URL</code> и <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
          <li>Что проект передеплоен после добавления переменных</li>
        </ul>
        <p><a href="https://philantrade.com/login">← Вернуться на страницу входа</a></p>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <h1>⏳ Выполняется вход...</h1>
        <p>Пожалуйста, подождите.</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 100 }}>
      <h1>Система отчётов для приютов</h1>
      <p>Войдите через <a href="https://philantrade.com/login">страницу входа на Tilda</a></p>
    </div>
  );
}
