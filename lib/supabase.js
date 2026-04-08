import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Для клиентских компонентов (браузер)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Для серверных действий (админка)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: {
        getAll() { return [] },
        setAll() {}
      }
    })
  : null
