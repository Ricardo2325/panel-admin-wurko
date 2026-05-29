import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MenuDia as MenuDiaType } from '../types/database'

// Tipos del menú que vamos a gestionar
const MENU_TIPOS = ['Primero', 'Segundo', 'Postre', 'Bebida', 'Precio']

async function fetchMenu(): Promise<MenuDiaType[]> {
  const { data, error } = await supabase
    .from('menu_dia')
    .select('*')
    .in('tipo', MENU_TIPOS)
  if (error) throw error
  return data
}

const menuSchema = z.object({
  Primero: z.string().max(200).optional(),
  Segundo: z.string().max(200).optional(),
  Postre: z.string().max(200).optional(),
  Bebida: z.string().max(200).optional(),
  Precio: z.string().max(50).optional(),
})

type MenuForm = z.infer<typeof menuSchema>

async function upsertMenuTipo(tipo: string, descripcion: string): Promise<void> {
  const { error } = await supabase
    .from('menu_dia')
    .upsert({ tipo, descripcion }, { onConflict: 'tipo' })
  if (error) throw error
}

export default function MenuDia() {
  const [saved, setSaved] = useState(false)
  const queryClient = useQueryClient()

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu_dia'],
    queryFn: fetchMenu,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MenuForm>({
    resolver: zodResolver(menuSchema),
  })

  // Precarga los valores del menú cuando llegan de Supabase
  useEffect(() => {
    if (menuItems.length > 0) {
      const values: MenuForm = {}
      for (const item of menuItems) {
        if (MENU_TIPOS.includes(item.tipo)) {
          (values as Record<string, string>)[item.tipo] = item.descripcion
        }
      }
      reset(values)
    }
  }, [menuItems, reset])

  const saveMutation = useMutation({
    mutationFn: async (data: MenuForm) => {
      await Promise.all(
        MENU_TIPOS.map((tipo) =>
          upsertMenuTipo(tipo, (data as Record<string, string>)[tipo] ?? '')
        )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_dia'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Menú del día</h1>
      <p className="text-slate-500 text-sm mb-6">
        El bot enviará este menú cuando alguien lo pida.
      </p>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : (
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 max-w-lg">

          {MENU_TIPOS.map((tipo) => (
            <div key={tipo}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{tipo}</label>
              <input
                type="text"
                maxLength={200}
                placeholder={tipo === 'Precio' ? 'Ej: 10€' : `Ej: Ensalada mixta`}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                {...register(tipo as keyof MenuForm)}
              />
              {errors[tipo as keyof MenuForm] && (
                <p className="text-red-500 text-xs mt-1">
                  {errors[tipo as keyof MenuForm]?.message}
                </p>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar menú'}
            </button>
            {saved && (
              <span className="text-green-600 text-sm font-medium">¡Guardado!</span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
