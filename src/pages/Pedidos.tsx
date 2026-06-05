import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Pedido } from '../types/database'

const ESTADOS = ['Todos', 'pendiente', 'preparando', 'listo', 'entregado']
const CANALES = ['Todos', 'web', 'whatsapp']

const estadoColors: Record<string, string> = {
  pendiente:  'bg-yellow-100 text-yellow-800',
  preparando: 'bg-blue-100 text-blue-800',
  listo:      'bg-purple-100 text-purple-800',
  entregado:  'bg-green-100 text-green-800',
}

const canalColors: Record<string, string> = {
  web:       'bg-sky-100 text-sky-700',
  whatsapp:  'bg-green-100 text-green-700',
}

async function fetchPedidos(estado: string, canal: string, fechaDesde: string): Promise<Pedido[]> {
  let query = supabase
    .from('pedidos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (estado !== 'Todos') query = query.eq('estado', estado)
  if (canal !== 'Todos')  query = query.eq('canal', canal)
  if (fechaDesde)         query = query.gte('created_at', fechaDesde)

  const { data, error } = await query
  if (error) throw error
  return data
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function getNombre(p: Pedido): string {
  if (p.canal === 'web') return p.cliente_nombre ?? '—'
  return p.numero_whatsapp ?? p.nombre ?? '—'
}

export default function Pedidos() {
  const [estado,     setEstado]     = useState('Todos')
  const [canal,      setCanal]      = useState('Todos')
  const [fechaDesde, setFechaDesde] = useState('')

  const { data: pedidos = [], isLoading } = useQuery<Pedido[]>({
    queryKey: ['pedidos', estado, canal, fechaDesde],
    queryFn: () => fetchPedidos(estado, canal, fechaDesde),
  })

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
      <p className="text-slate-500 text-sm mb-5">Historial de pedidos.</p>

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

        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          {CANALES.map((c) => (
            <option key={c} value={c}>{c === 'Todos' ? 'Todos los canales' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        {fechaDesde && (
          <button onClick={() => setFechaDesde('')} className="text-xs text-slate-400 hover:text-slate-600">
            × Limpiar fecha
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm py-8">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <p className="text-slate-400 text-sm py-8">Sin pedidos con estos filtros.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Código</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Hora</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Canal</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                    {p.codigo_pedido ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{getNombre(p)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.empresa ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.canal === 'web' ? (p.hora_deseada ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{p.total != null ? `${p.total.toFixed(2)}€` : '—'}</td>
                  <td className="px-4 py-3">
                    {p.estado && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColors[p.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                        {p.estado}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${canalColors[p.canal ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                      {p.canal ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
