import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'

const DOMAIN = '@wurko.local'

const loginSchema = z.object({
  usuario: z.string().min(1, 'Introduce tu usuario').regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo'),
  password: z.string().min(1, 'Introduce tu contraseña'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setServerError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: data.usuario.toLowerCase().trim() + DOMAIN,
      password: data.password,
    })

    setLoading(false)

    if (error) {
      setServerError('Usuario o contraseña incorrectos.')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-xl shadow-md w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Wurko Padel</h1>
          <p className="text-slate-500 text-sm mt-1">Panel de administración</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="jefe, empleado, tecnico..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              {...register('usuario')}
            />
            {errors.usuario && (
              <p className="text-red-500 text-xs mt-1">{errors.usuario.message}</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
