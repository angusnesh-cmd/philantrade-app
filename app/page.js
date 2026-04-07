'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    // Функция для завершения входа
    const handleAuthCallback = async () => {
      // Получаем фрагмент (часть после #) из URL в браузере
      const hashFragment = window.location.hash.substring(1);
      const params = new URLSearchParams(hashFragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      // Если есть access_token и это magiclink — завершаем вход
      if (accessToken && type === 'magiclink') {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          // Убираем фрагмент из URL и перенаправляем на /dashboard
          window.location.hash = '';
          router.push('/dashboard');
          return;
        }
      }

      // Если пользователь уже вошёл, просто перенаправляем
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/dashboard');
        return;
      }

      // Если ничего из вышеперечисленного — показываем страницу входа
      setIsProcessing(false);
    };

    handleAuthCallback();
  }, [router]);

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
      <p>
        Войдите через{' '}
        <a href="https://philantrade.com/login">страницу входа на Tilda</a>
      </p>
    </div>
  );
}
