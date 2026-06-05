import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import type { NumeroAdmin } from '../types/database'

const phoneSchema = z
  .string()
  .min(7, 'Mínimo 7 dígitos')
  .max(20, 'Máximo 20 caracteres')
  .regex(/^\+?[\d\s\-()]+$/, 'Formato de número inválido')

async function fetchAdmins(): Promise<NumeroAdmin[]> {
  const { data, error } = await supabase
    .from('numeros_admin')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

async function addAdmin(payload: { numero: string; nombre: string }): Promise<void> {
  const { error } = await supabase
    .from('numeros_admin')
    .insert({ numero: payload.numero.trim(), nombre: payload.nombre.trim() || null })
  if (error) throw error
}

async function removeAdmin(id: number): Promise<void> {
  const { error } = await supabase
    .from('numeros_admin')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export default function AdminsNumeros() {
  const [numero, setNumero] = useState('')
  const [nombre, setNombre] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: admins = [], isLoading } = useQuery<NumeroAdmin[]>({
    queryKey: ['admins'],
    queryFn: fetchAdmins,
  })

  const addMutation = useMutation({
    mutationFn: addAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] })
      setNumero('')
      setNombre('')
      setFieldError(null)
    },
    onError: () => setFieldError('Error al guardar. ¿El número ya existe?'),
  })

  const removeMutation = useMutation({
    mutationFn: removeAdmin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admins'] }),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const parse = phoneSchema.safeParse(numero)
    if (!parse.success) {
      setFieldError(parse.error.issues[0].message)
      return
    }
    addMutation.mutate({ numero, nombre })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Números admin del bot</h1>
      <p className="text-slate-500 text-sm mb-6">
        Estos números pueden enviar comandos de administrador al bot de WhatsApp.
      </p>

      <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Número de WhatsApp</label>
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="+34612345678"
              maxLength={20}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre (opcional)</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del admin"
              maxLength={100}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        {fieldError && <p className="text-red-500 text-xs">{fieldError}</p>}

        <button
          type="submit"
          disabled={addMutation.isPending || !numero.trim()}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {addMutation.isPending ? 'Guardando...' : 'Agregar admin'}
        </button>
      </form>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : admins.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay números admin configurados.</p>
      ) : (
        <ul className="space-y-2">
          {admins.map((item: NumeroAdmin) => (
            <li
              key={item.id}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3"
            >
              <div>
                <span className="text-sm font-medium text-slate-800">{item.numero}</span>
                {item.nombre && (
                  <p className="text-xs text-slate-500 mt-0.5">{item.nombre}</p>
                )}
              </div>
              <button
                onClick={() => removeMutation.mutate(item.id)}
                disabled={removeMutation.isPending}
                className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
