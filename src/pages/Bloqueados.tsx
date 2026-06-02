import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import type { NumeroBloqueado } from '../types/database'

const phoneSchema = z
  .string()
  .min(7, 'Mínimo 7 dígitos')
  .max(20, 'Máximo 20 caracteres')
  .regex(/^\+?[\d\s\-()]+$/, 'Solo números, espacios, guiones y paréntesis')

async function fetchBloqueados(): Promise<NumeroBloqueado[]> {
  const { data, error } = await supabase
    .from('numeros_bloqueados')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

async function addBloqueado(payload: { numero: string; motivo: string }): Promise<void> {
  const { error } = await supabase
    .from('numeros_bloqueados')
    .insert({ numero: payload.numero.trim(), motivo: payload.motivo.trim() || null })
  if (error) throw error
}

async function removeBloqueado(id: number): Promise<void> {
  const { error } = await supabase
    .from('numeros_bloqueados')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export default function Bloqueados() {
  const [numero, setNumero] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: bloqueados = [], isLoading } = useQuery<NumeroBloqueado[]>({
    queryKey: ['bloqueados'],
    queryFn: fetchBloqueados,
  })

  const addMutation = useMutation({
    mutationFn: addBloqueado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloqueados'] })
      setNumero('')
      setMotivo('')
      setFieldError(null)
    },
    onError: () => setFieldError('Error al guardar. ¿El número ya está bloqueado?'),
  })

  const removeMutation = useMutation({
    mutationFn: removeBloqueado,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bloqueados'] }),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const parse = phoneSchema.safeParse(numero)
    if (!parse.success) {
      setFieldError(parse.error.issues[0].message)
      return
    }
    addMutation.mutate({ numero, motivo })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Números bloqueados</h1>
      <p className="text-slate-500 text-sm mb-6">
        Estos números no recibirán respuesta del bot de WhatsApp.
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Spam, protestas..."
              maxLength={200}
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
          {addMutation.isPending ? 'Guardando...' : 'Bloquear número'}
        </button>
      </form>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : bloqueados.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay números bloqueados.</p>
      ) : (
        <ul className="space-y-2">
          {bloqueados.map((item: NumeroBloqueado) => (
            <li
              key={item.id}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3"
            >
              <div>
                <span className="text-sm font-medium text-slate-800">{item.numero}</span>
                {item.motivo && (
                  <p className="text-xs text-slate-500 mt-0.5">{item.motivo}</p>
                )}
              </div>
              <button
                onClick={() => removeMutation.mutate(item.id)}
                disabled={removeMutation.isPending}
                className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Desbloquear
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
