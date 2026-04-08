import { createBrowserClient } from '@supabase/ssr'

// Берём переменные из глобального объекта, если process.env не работает
const getEnvVar = (name) => {
  // Пытаемся через process.env (сервер)
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name]
  }
  // Для браузера — из window._ENV или напрямую
  if (typeof window !== 'undefined') {
    return window._ENV?.[name] || window[name]
  }
  return undefined
}

// ВРЕМЕННО: хардкод для теста
const supabaseUrl = 'https://xatvmdctucbyacxqffxi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHZtZGN0dWNieWFjeHFmZnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDkxMzAsImV4cCI6MjA5MDYyNTEzMH0.xUbZtT0_spWI4b_tnZJx01NEFzLA0agdDUiWCPhWZ04'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
