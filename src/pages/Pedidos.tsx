import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Pedido } from '../types/database'

const ESTADOS = ['Todos', 'pendiente', 'confirmado', 'entregado', 'cancelado']

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

  if (estado !== 'Todos') {
    query = query.eq('estado', estado)
  }
  if (fechaDesde) {
    query = query.gte('created_at', fechaDesde)
  }

  const { data, error } = await query
  if (error) throw error
  return data
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

export default function Pedidos() {
  const [estado, setEstado] = useState('Todos')
  const [fechaDesde, setFechaDesde] = useState('')

  const { data: pedidos = [], isLoading } = useQuery<Pedido[]>({
    queryKey: ['pedidos', estado, fechaDesde],
    queryFn: () => fetchPedidos(estado, fechaDesde),
  })

  const total = pedidos.reduce((sum: number, p: Pedido) => sum + (p.total ?? 0), 0)

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
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e === 'Todos' ? 'Todos los estados' : e.charAt(0).toUpperCase() + e.slice(1)}</option>
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
          {pedidos.map((pedido: Pedido) => (
            <div key={pedido.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{pedido.nombre ?? 'Sin nombre'}</p>
                  <p className="text-xs text-slate-500">{pedido.telefono} · {formatDate(pedido.created_at)}</p>
                </div>
                <div className="text-right">
                  {pedido.estado && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[pedido.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                      {pedido.estado}
                    </span>
                  )}
                  {pedido.total != null && (
                    <p className="text-sm font-bold text-slate-900 mt-1">{pedido.total.toFixed(2)}€</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-500">
                {pedido.direccion && <p>📍 {pedido.direccion}{pedido.zona ? ` (${pedido.zona})` : ''}</p>}
                {pedido.hora_entrega && <p>🕐 {pedido.hora_entrega}</p>}
                {pedido.forma_pago && <p>💳 {pedido.forma_pago}</p>}
                {pedido.empresa && <p>🏢 {pedido.empresa}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
