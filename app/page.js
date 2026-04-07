'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const hashFragment = window.location.hash.substring(1);
      const params = new URLSearchParams(hashFragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && type === 'magiclink') {
        // Устанавливаем сессию
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (!error) {
          // Очищаем hash и перенаправляем
          window.location.href = '/dashboard';
          return;
        }
      }

      // Проверяем существующую сессию
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
        return;
      }

      setIsProcessing(false);
    };

    handleAuthCallback();
  }, [router]);

  if (isProcessing) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <h1>⏳ Выполняется вход...</h1>
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
