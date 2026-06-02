import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Pedido, LineaPedido } from '../types/database'

const ESTADOS_FILTRO = ['Todos', 'pendiente', 'confirmado', 'entregado', 'cancelado']
const ESTADOS_EDIT = ['pendiente', 'confirmado', 'entregado', 'cancelado']

const estadoColors: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmado: 'bg-blue-100 text-blue-800',
  entregado: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
}

async function fetchPedidos(estado: string, fechaDesde: string): Promise<Pedido[]> {
  let query = supabase
    .from('pedidos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (estado !== 'Todos') query = query.eq('estado', estado)
  if (fechaDesde) query = query.gte('created_at', fechaDesde)
  const { data, error } = await query
  if (error) throw error
  return data
}

async function fetchLineas(pedidoId: number): Promise<LineaPedido[]> {
  const { data, error } = await supabase
    .from('productos_pedido')
    .select('id, pedido_id, nombre, cantidad, precio_unitario, extras_pedido(id, producto_pedido_id, nombre, precio)')
    .eq('pedido_id', pedidoId)
    .order('id')
  if (error) throw error
  return (data ?? []) as LineaPedido[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Pedidos() {
  const { role } = useAuth()
  const canEditEstado = role === 'dev' || role === 'jefe'
  const queryClient = useQueryClient()

  const [estado, setEstado] = useState('Todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [lineas, setLineas] = useState<Record<number, LineaPedido[]>>({})
  const [loadingLineas, setLoadingLineas] = useState<Set<number>>(new Set())

  const { data: pedidos = [], isLoading } = useQuery<Pedido[]>({
    queryKey: ['pedidos', estado, fechaDesde],
    queryFn: () => fetchPedidos(estado, fechaDesde),
  })

  const updateEstado = useMutation({
    mutationFn: async ({ id, nuevoEstado }: { id: number; nuevoEstado: string }) => {
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos'] }),
  })

  async function toggleExpand(pedidoId: number) {
    if (expanded.has(pedidoId)) {
      setExpanded(prev => { const s = new Set(prev); s.delete(pedidoId); return s })
      return
    }
    if (!lineas[pedidoId]) {
      setLoadingLineas(prev => new Set(prev).add(pedidoId))
      const data = await fetchLineas(pedidoId)
      setLineas(prev => ({ ...prev, [pedidoId]: data }))
      setLoadingLineas(prev => { const s = new Set(prev); s.delete(pedidoId); return s })
    }
    setExpanded(prev => new Set(prev).add(pedidoId))
  }

  const total = pedidos.reduce((sum, p) => sum + (p.total ?? 0), 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900">Pedidos</h1>
        {pedidos.length > 0 && (
          <div className="text-right mt-1">
            <p className="text-xs text-slate-500">{pedidos.length} pedidos</p>
            <p className="text-sm font-semibold text-slate-800">{total.toFixed(2)}€ total</p>
          </div>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-5">Historial de pedidos del chatbot.</p>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          {ESTADOS_FILTRO.map((e) => (
            <option key={e} value={e}>
              {e === 'Todos' ? 'Todos los estados' : e.charAt(0).toUpperCase() + e.slice(1)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value ? new Date(e.target.value).toISOString() : '')}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        {fechaDesde && (
          <button onClick={() => setFechaDesde('')} className="text-sm text-slate-500 hover:text-slate-800">
            Limpiar fecha
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay pedidos con esos filtros.</p>
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido) => {
            const isExpanded = expanded.has(pedido.id)
            const isLoadingL = loadingLineas.has(pedido.id)
            const pedidoLineas = lineas[pedido.id] ?? []

            return (
              <div key={pedido.id} className="bg-white border border-slate-200 rounded-xl p-4">
                {/* Cabecera */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{pedido.nombre ?? 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500">{pedido.telefono} · {formatDate(pedido.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEditEstado ? (
                      <select
                        value={pedido.estado ?? 'pendiente'}
                        onChange={(e) => updateEstado.mutate({ id: pedido.id, nuevoEstado: e.target.value })}
                        disabled={updateEstado.isPending}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer border border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400 ${estadoColors[pedido.estado ?? ''] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {ESTADOS_EDIT.map(e => (
                          <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                        ))}
                      </select>
                    ) : (
                      pedido.estado && (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[pedido.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                          {pedido.estado}
                        </span>
                      )
                    )}
                    {pedido.total != null && (
                      <p className="text-sm font-bold text-slate-900 shrink-0">{pedido.total.toFixed(2)}€</p>
                    )}
                  </div>
                </div>

                {/* Info secundaria */}
                <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-500 mb-3">
                  {pedido.empresa && <p>🏢 {pedido.empresa}</p>}
                  {pedido.hora_entrega && <p>🕐 {pedido.hora_entrega}</p>}
                  {pedido.direccion && <p>📍 {pedido.direccion}{pedido.zona ? ` (${pedido.zona})` : ''}</p>}
                  {pedido.forma_pago && <p>💳 {pedido.forma_pago}</p>}
                </div>

                {/* Botón expandir */}
                <button
                  onClick={() => toggleExpand(pedido.id)}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                >
                  <span>{isExpanded ? '▲' : '▼'}</span>
                  <span>{isExpanded ? 'Ocultar líneas' : 'Ver líneas del pedido'}</span>
                </button>

                {/* Líneas */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {isLoadingL ? (
                      <p className="text-xs text-slate-400">Cargando...</p>
                    ) : pedidoLineas.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Sin líneas registradas.</p>
                    ) : (
                      <ul className="space-y-2">
                        {pedidoLineas.map((linea) => (
                          <li key={linea.id}>
                            <div className="flex justify-between text-xs text-slate-700 font-medium">
                              <span>{linea.cantidad}x {linea.nombre}</span>
                              <span>{(linea.cantidad * linea.precio_unitario).toFixed(2)}€</span>
                            </div>
                            {linea.extras_pedido?.map((extra) => (
                              <div key={extra.id} className="flex justify-between text-xs text-slate-400 pl-3 mt-0.5">
                                <span>+ {extra.nombre}</span>
                                <span>{extra.precio.toFixed(2)}€</span>
                              </div>
                            ))}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
