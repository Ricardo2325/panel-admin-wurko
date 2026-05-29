import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { MenuDia as MenuDiaType } from '../types/database'

const CURSOS = ['Primero', 'Segundo', 'Postre', 'Bebida'] as const
type Curso = typeof CURSOS[number]
const MENU_TIPOS = ['Primero', 'Segundo', 'Postre', 'Bebida']
const SEP = ' | '

async function fetchMenu(): Promise<MenuDiaType[]> {
  const { data, error } = await supabase
    .from('menu_dia')
    .select('*')
    .in('tipo', MENU_TIPOS)
  if (error) throw error
  return data
}

async function upsertMenuTipo(tipo: string, descripcion: string): Promise<void> {
  const { error } = await supabase
    .from('menu_dia')
    .upsert({ tipo, descripcion }, { onConflict: 'tipo' })
  if (error) throw error
}

export default function MenuDia() {
  const [opciones, setOpciones] = useState<Record<Curso, string[]>>({
    Primero: [''],
    Segundo: [''],
    Postre: [''],
    Bebida: [''],
  })
  const [saved, setSaved] = useState(false)
  const queryClient = useQueryClient()

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu_dia'],
    queryFn: fetchMenu,
  })

  useEffect(() => {
    if (menuItems.length === 0) return
    for (const item of menuItems) {
      if (CURSOS.includes(item.tipo as Curso)) {
        const parts = item.descripcion ? item.descripcion.split(SEP) : ['']
        setOpciones(prev => ({ ...prev, [item.tipo]: parts.length > 0 ? parts : [''] }))
      }
    }
  }, [menuItems])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(CURSOS.map((curso) => {
        const validos = opciones[curso].map(v => v.trim()).filter(Boolean)
        return upsertMenuTipo(curso, validos.join(SEP))
      }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_dia'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function setOpcion(curso: Curso, idx: number, value: string) {
    setOpciones(prev => {
      const arr = [...prev[curso]]
      arr[idx] = value
      return { ...prev, [curso]: arr }
    })
  }

  function addOpcion(curso: Curso) {
    setOpciones(prev => ({ ...prev, [curso]: [...prev[curso], ''] }))
  }

  function removeOpcion(curso: Curso, idx: number) {
    setOpciones(prev => {
      const arr = prev[curso].filter((_, i) => i !== idx)
      return { ...prev, [curso]: arr.length > 0 ? arr : [''] }
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Menú del día</h1>
      <p className="text-slate-500 text-sm mb-6">El bot enviará este menú cuando alguien lo pida.</p>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 max-w-lg">

          {CURSOS.map((curso) => (
            <div key={curso}>
              <p className="text-sm font-semibold text-slate-700 mb-2">{curso}</p>
              <div className="space-y-2">
                {opciones[curso].map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-16 shrink-0">
                      {opciones[curso].length > 1 ? `Opción ${idx + 1}` : 'Plato'}
                    </span>
                    <input
                      type="text"
                      maxLength={200}
                      value={val}
                      onChange={(e) => setOpcion(curso, idx, e.target.value)}
                      placeholder="Ej: Ensalada mixta"
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    {opciones[curso].length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOpcion(curso, idx)}
                        className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none px-1"
                        title="Eliminar opción"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addOpcion(curso)}
                className="mt-2 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
              >
                <span className="text-base leading-none">+</span> Añadir opción
              </button>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar menú'}
            </button>
            {saved && <span className="text-green-600 text-sm font-medium">¡Guardado!</span>}
          </div>
        </div>
      )}
    </div>
  )
}
