import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Producto, ProductoCategoria } from '../types/database'

const CATEGORIAS: ProductoCategoria[] = [
  'Bocadillos', 'Pulgas', 'Sandwiches', 'Croissants',
  'Hamburguesas y Perritos', 'Arepas', 'Papas Locas', 'Tapas',
  'Tablas', 'Salchichas', 'Bebidas Refrescos', 'Agua',
  'Zumos y Batidos', 'Cervezas', 'Vino', 'Cafés', 'Infusiones',
  'Dulces y Bollería', 'Snacks', 'Postres', 'Menú', 'Extras',
  'Extras Papas Locas', 'Suplementos Menú',
]

async function fetchProductos(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('categoria')
    .order('nombre')
  if (error) throw error
  return data
}

async function toggleActivo(id: number, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('productos')
    .update({ activo })
    .eq('id', id)
  if (error) throw error
}

async function updatePrecio(id: number, precio: number): Promise<void> {
  if (precio < 0 || precio > 9999) throw new Error('Precio fuera de rango')
  const { error } = await supabase
    .from('productos')
    .update({ precio })
    .eq('id', id)
  if (error) throw error
}

function PrecioEditable({ producto }: { producto: Producto }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(producto.precio))
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (precio: number) => updatePrecio(producto.id, precio),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      setEditing(false)
    },
    onError: () => setValue(String(producto.precio)),
  })

  function handleBlur() {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) {
      setValue(String(producto.precio))
      setEditing(false)
      return
    }
    mutation.mutate(num)
  }

  if (editing) {
    return (
      <input
        type="number"
        step="0.01"
        min="0"
        max="9999"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') handleBlur() }}
        className="w-20 border border-slate-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-xs text-slate-700 hover:text-slate-900 hover:underline"
    >
      {producto.precio.toFixed(2)}€
    </button>
  )
}

export default function Carta() {
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todas')
  const [busqueda, setBusqueda] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)
  const queryClient = useQueryClient()

  const { data: productos = [], isLoading } = useQuery<Producto[]>({
    queryKey: ['productos'],
    queryFn: fetchProductos,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => toggleActivo(id, activo),
    onMutate: async ({ id, activo }: { id: number; activo: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['productos'] })
      const prev = queryClient.getQueryData<Producto[]>(['productos'])
      queryClient.setQueryData<Producto[]>(['productos'], (old: Producto[] | undefined) =>
        old?.map((p: Producto) => p.id === id ? { ...p, activo } : p) ?? []
      )
      return { prev }
    },
    onError: (_err: unknown, _vars: { id: number; activo: boolean }, ctx: { prev: Producto[] | undefined } | undefined) => {
      if (ctx?.prev) queryClient.setQueryData(['productos'], ctx.prev)
    },
  })

  const filtered = useMemo(() => {
    return productos.filter((p: Producto) => {
      if (categoriaFiltro !== 'Todas' && p.categoria !== categoriaFiltro) return false
      if (soloActivos && !p.activo) return false
      if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
  }, [productos, categoriaFiltro, busqueda, soloActivos])

  const activos = productos.filter((p: Producto) => p.activo).length

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900">Carta de productos</h1>
        <span className="text-xs text-slate-500 mt-2">
          {activos} activos / {productos.length} total
        </span>
      </div>
      <p className="text-slate-500 text-sm mb-5">
        Hacé clic en el precio para editarlo. Usá el toggle para activar/desactivar un producto.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 w-48"
        />
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          <option value="Todas">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="rounded"
          />
          Solo activos
        </label>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando {productos.length > 0 ? `${productos.length}` : ''} productos...</p>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-2">{filtered.length} productos</p>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Categoría</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Precio</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Activo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((producto: Producto) => (
                  <tr key={producto.id} className={`hover:bg-slate-50 ${!producto.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-800">{producto.nombre}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{producto.categoria}</td>
                    <td className="px-4 py-2.5 text-right">
                      <PrecioEditable producto={producto} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => toggleMutation.mutate({ id: producto.id, activo: !producto.activo })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          producto.activo ? 'bg-slate-800' : 'bg-slate-300'
                        }`}
                        aria-label={producto.activo ? 'Desactivar' : 'Activar'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            producto.activo ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8">Sin resultados para los filtros aplicados.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
