import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ProductoAgotado } from '../types/database'

async function fetchAgotados(): Promise<ProductoAgotado[]> {
  const { data, error } = await supabase
    .from('productos_agotados')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProductoAgotado[]
}

async function addAgotado(nombre: string): Promise<void> {
  const { error } = await supabase
    .from('productos_agotados')
    .insert({ nombre: nombre.trim() })
  if (error) throw error
}

async function removeAgotado(id: number): Promise<void> {
  const { error } = await supabase
    .from('productos_agotados')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export default function Agotados() {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: agotados = [], isLoading } = useQuery<ProductoAgotado[]>({
    queryKey: ['agotados'],
    queryFn: fetchAgotados,
  })

  const addMutation = useMutation({
    mutationFn: addAgotado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agotados'] })
      setInput('')
      setError(null)
    },
    onError: () => setError('Error al agregar el producto'),
  })

  const removeMutation = useMutation({
    mutationFn: removeAgotado,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agotados'] }),
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    if (trimmed.length > 100) {
      setError('Nombre demasiado largo (máx. 100 caracteres)')
      return
    }
    addMutation.mutate(trimmed)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Productos agotados</h1>
      <p className="text-slate-500 text-sm mb-6">
        Lo que está aquí el bot responderá que no está disponible hoy.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nombre del producto..."
          maxLength={100}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        <button
          type="submit"
          disabled={addMutation.isPending || !input.trim()}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {addMutation.isPending ? 'Agregando...' : 'Agregar'}
        </button>
      </form>

      {error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : agotados.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay productos agotados hoy.</p>
      ) : (
        <ul className="space-y-2">
          {agotados.map((item: ProductoAgotado) => (
            <li
              key={item.id}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3"
            >
              <span className="text-sm text-slate-800">{item.nombre}</span>
              <button
                onClick={() => removeMutation.mutate(item.id)}
                disabled={removeMutation.isPending}
                className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
