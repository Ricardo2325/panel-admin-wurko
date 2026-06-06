import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Pedido, ProductoPedido } from '../types/database'

type PedidoConItems = Pedido & { productos_pedido: ProductoPedido[] }

const ESTADOS = ['Todos', 'pendiente', 'confirmado', 'entregado', 'cancelado']

const estadoColors: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmado: 'bg-blue-100 text-blue-800',
  entregado: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
}

const canalColors: Record<string, string> = {
  web: 'bg-purple-100 text-purple-800',
  whatsapp: 'bg-green-100 text-green-800',
}

function todayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function fetchPedidos(estado: string, fechaDesde: string): Promise<PedidoConItems[]> {
  let query = supabase
    .from('pedidos')
    .select('*, productos_pedido(*)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (estado !== 'Todos') query = query.eq('estado', estado)
  if (fechaDesde) query = query.gte('created_at', fechaDesde)

  const { data, error } = await query
  if (error) throw error
  return data as PedidoConItems[]
}

export default function Pedidos() {
  const [estado, setEstado] = useState('Todos')
  const [fechaDesde, setFechaDesde] = useState(todayISO())
  const queryClient = useQueryClient()

  const { data: pedidos = [], isLoading } = useQuery<PedidoConItems[]>({
    queryKey: ['pedidos', estado, fechaDesde],
    queryFn: () => fetchPedidos(estado, fechaDesde),
  })

  useEffect(() => {
    const channel = supabase
      .channel('pedidos-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => {
        queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const totalFacturado = pedidos.reduce((sum, p) => sum + (p.total ?? 0), 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Pedidos</h1>
          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            En vivo
          </span>
        </div>
        {pedidos.length > 0 && (
          <div className="text-right mt-1">
            <p className="text-xs text-slate-500">{pedidos.length} pedidos</p>
            <p className="text-sm font-semibold text-slate-800">{totalFacturado.toFixed(2)}€</p>
          </div>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-5">Pedidos recibidos por la web.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e === 'Todos' ? 'Todos los estados' : e.charAt(0).toUpperCase() + e.slice(1)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fechaDesde ? new Date(fechaDesde).toISOString().split('T')[0] : ''}
          onChange={(e) => setFechaDesde(e.target.value ? new Date(e.target.value).toISOString() : '')}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        <button
          onClick={() => setFechaDesde(todayISO())}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          Hoy
        </button>
        {fechaDesde && (
          <button
            onClick={() => setFechaDesde('')}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
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
          {pedidos.map((pedido) => (
            <div key={pedido.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {pedido.codigo_pedido && (
                      <span className="font-mono text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {pedido.codigo_pedido}
                      </span>
                    )}
                    {pedido.canal && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${canalColors[pedido.canal] ?? 'bg-slate-100 text-slate-600'}`}>
                        {pedido.canal}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-slate-900 text-sm">
                    {pedido.cliente_nombre ?? 'Sin nombre'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(pedido.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {pedido.estado && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[pedido.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                      {pedido.estado}
                    </span>
                  )}
                  {pedido.hora_deseada && (
                    <p className="text-xs text-slate-500">🕐 {pedido.hora_deseada}</p>
                  )}
                </div>
              </div>

              {pedido.productos_pedido?.length > 0 && (
                <div className="border-t border-slate-100 pt-2 mb-2 space-y-1">
                  {pedido.productos_pedido.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-700">
                      <span>
                        <span className="font-medium">{item.cantidad}×</span> {item.nombre}
                        {item.modificaciones && (
                          <span className="text-slate-400 ml-1">({item.modificaciones})</span>
                        )}
                      </span>
                      {item.subtotal != null && (
                        <span className="text-slate-500 shrink-0 ml-2">{item.subtotal.toFixed(2)}€</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <p className="text-xs text-slate-400 truncate max-w-[60%]">
                  {pedido.notas ? `📝 ${pedido.notas}` : ''}
                </p>
                {pedido.total != null && (
                  <p className="text-sm font-bold text-slate-900">{pedido.total.toFixed(2)}€</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
