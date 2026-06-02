import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'dev' | 'jefe' | 'staff'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  role: UserRole
}

function resolveRole(user: User | null): UserRole {
  const meta = user?.user_metadata?.role
  if (meta === 'jefe' || meta === 'staff') return meta
  return 'dev'
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    role: 'dev',
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false, role: resolveRole(session?.user ?? null) })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session, loading: false, role: resolveRole(session?.user ?? null) })
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}
