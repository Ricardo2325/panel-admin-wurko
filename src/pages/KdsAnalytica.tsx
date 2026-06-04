import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'

type Period = 'hoy' | 7 | 30

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const COLOR_COCINA = '#0f172a'
const COLOR_BARRA = '#3b82f6'

interface KdsTiempoRow {
  id: number
  pedido_id: number
  pantalla: 'cocina' | 'barra'
  iniciado_at: string
  listo_at: string
  tiempo_segundos: number
  pedidos: { empresa: string | null; nombre: string | null } | null
}

interface ProductoPedidoRow {
  pedido_id: number
  nombre: string
  cantidad: number
}

function getCutoff(period: Period): Date {
  const now = new Date()
  if (period === 'hoy') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const d = new Date(now)
  d.setDate(d.getDate() - period)
  return d
}

function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function formatTiempo(seg: number): string {
  if (seg < 60) return `${seg}s`
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function mean(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

async function fetchKdsTiempos(period: Period): Promise<KdsTiempoRow[]> {
  const cutoff = getCutoff(period)
  const { data, error } = await supabase
    .from('kds_tiempos')
    .select('id, pedido_id, pantalla, iniciado_at, listo_at, tiempo_segundos, pedidos(empresa, nombre)')
    .not('listo_at', 'is', null)
    .gte('iniciado_at', cutoff.toISOString())
    .order('iniciado_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  return (data ?? []) as unknown as KdsTiempoRow[]
}

async function fetchProductosPedido(pedidoIds: number[]): Promise<ProductoPedidoRow[]> {
  if (!pedidoIds.length) return []
  const { data, error } = await supabase
    .from('productos_pedido')
    .select('pedido_id, nombre, cantidad')
    .in('pedido_id', pedidoIds)
  if (error) throw error
  return (data ?? []) as ProductoPedidoRow[]
}

function TimeTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((e) => e.value != null && (
        <p key={e.name} className="font-semibold" style={{ color: e.color }}>
          {e.name}: {formatTiempo(e.value)}
        </p>
      ))}
    </div>
  )
}

export default function KdsAnalytica() {
  const [period, setPeriod] = useState<Period>(7)

  const { data: tiempos = [], isLoading } = useQuery<KdsTiempoRow[]>({
    queryKey: ['kds-tiempos', period],
    queryFn: () => fetchKdsTiempos(period),
    staleTime: 60_000,
  })

  const top10Lentos = useMemo(
    () => [...tiempos].sort((a, b) => b.tiempo_segundos - a.tiempo_segundos).slice(0, 10),
    [tiempos],
  )

  const top10Ids = useMemo(() => top10Lentos.map((t) => t.pedido_id), [top10Lentos])

  const { data: productos = [] } = useQuery<ProductoPedidoRow[]>({
    queryKey: ['kds-productos', top10Ids],
    queryFn: () => fetchProductosPedido(top10Ids),
    enabled: top10Ids.length > 0,
    staleTime: 60_000,
  })

  const productosByPedido = useMemo(() => {
    const grouped = new Map<number, string>()
    const byId = new Map<number, { nombre: string; cantidad: number }[]>()
    for (const p of productos) {
      const list = byId.get(p.pedido_id) ?? []
      list.push(p)
      byId.set(p.pedido_id, list)
    }
    for (const [id, items] of byId) {
      grouped.set(id, items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', '))
    }
    return grouped
  }, [productos])

  // ── Métricas del período ──
  const cocina = useMemo(() => tiempos.filter((t) => t.pantalla === 'cocina'), [tiempos])
  const barra = useMemo(() => tiempos.filter((t) => t.pantalla === 'barra'), [tiempos])
  const tiempoMedioCocina = mean(cocina.map((t) => t.tiempo_segundos))
  const tiempoMedioBarra = mean(barra.map((t) => t.tiempo_segundos))

  // ── Métricas de hoy (siempre hoy, independiente del período) ──
  const todayStart = useMemo(() => getTodayStart(), [])
  const hoy = useMemo(
    () => tiempos.filter((t) => new Date(t.iniciado_at) >= todayStart),
    [tiempos, todayStart],
  )
  const hoyCocina = useMemo(() => hoy.filter((t) => t.pantalla === 'cocina'), [hoy])
  const hoyBarra = useMemo(() => hoy.filter((t) => t.pantalla === 'barra'), [hoy])
  const masRapidoHoy = hoy.length ? Math.min(...hoy.map((t) => t.tiempo_segundos)) : null
  const masLentoHoy = hoy.length ? Math.max(...hoy.map((t) => t.tiempo_segundos)) : null

  // ── Gráfica: tiempo medio por hora del día ──
  const hourData = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      const items = tiempos.filter((t) => new Date(t.iniciado_at).getHours() === h)
      const c = items.filter((t) => t.pantalla === 'cocina').map((t) => t.tiempo_segundos)
      const b = items.filter((t) => t.pantalla === 'barra').map((t) => t.tiempo_segundos)
      return {
        hora: `${String(h).padStart(2, '0')}h`,
        Cocina: c.length ? mean(c) : undefined,
        Barra: b.length ? mean(b) : undefined,
      }
    }).filter((d) => d.Cocina !== undefined || d.Barra !== undefined)
  }, [tiempos])

  // ── Gráfica: tiempo medio por día de la semana (Lun→Dom) ──
  const weekData = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
      const items = tiempos.filter((t) => new Date(t.iniciado_at).getDay() === dayIdx)
      const c = items.filter((t) => t.pantalla === 'cocina').map((t) => t.tiempo_segundos)
      const b = items.filter((t) => t.pantalla === 'barra').map((t) => t.tiempo_segundos)
      return {
        dia: DIAS_SEMANA[dayIdx],
        Cocina: c.length ? mean(c) : 0,
        Barra: b.length ? mean(b) : 0,
      }
    })
  }, [tiempos])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 text-sm">Cargando analítica KDS...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analítica KDS</h1>
          <p className="text-slate-500 text-sm mt-0.5">Tiempos de preparación — cocina y barra</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {(['hoy', 7, 30] as Period[]).map((p) => (
            <button
              key={String(p)}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p === 'hoy' ? 'Hoy' : `${p}d`}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-1">Tiempo medio cocina</p>
          <p className="text-2xl font-bold text-slate-900">
            {cocina.length ? formatTiempo(tiempoMedioCocina) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">{cocina.length} registros</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-1">Tiempo medio barra</p>
          <p className="text-2xl font-bold text-slate-900">
            {barra.length ? formatTiempo(tiempoMedioBarra) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">{barra.length} registros</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-1">Pedidos procesados</p>
          <p className="text-2xl font-bold text-slate-900">{tiempos.length}</p>
          <p className="text-xs text-slate-400 mt-1">en el período</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-1">Procesados hoy</p>
          <p className="text-2xl font-bold text-slate-900">{hoy.length}</p>
          <p className="text-xs text-slate-400 mt-1">
            {hoyCocina.length} cocina · {hoyBarra.length} barra
          </p>
        </div>
      </div>

      {/* Mini-stats: más rápido / más lento hoy */}
      <div className="flex gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Más rápido hoy</span>
          <span className="text-sm font-bold text-emerald-600">
            {masRapidoHoy !== null ? formatTiempo(masRapidoHoy) : '—'}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Más lento hoy</span>
          <span className={`text-sm font-bold ${
            masLentoHoy !== null && masLentoHoy > 900 ? 'text-red-500' : 'text-slate-800'
          }`}>
            {masLentoHoy !== null ? formatTiempo(masLentoHoy) : '—'}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Media cocina hoy</span>
          <span className="text-sm font-bold text-slate-800">
            {hoyCocina.length ? formatTiempo(mean(hoyCocina.map((t) => t.tiempo_segundos))) : '—'}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Media barra hoy</span>
          <span className="text-sm font-bold text-slate-800">
            {hoyBarra.length ? formatTiempo(mean(hoyBarra.map((t) => t.tiempo_segundos))) : '—'}
          </span>
        </div>
      </div>

      {/* Tiempo medio por hora del día */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          Tiempo medio por hora del día
        </h2>
        <p className="text-xs text-slate-400 mb-4">Detecta colapsos de cocina por franja horaria</p>
        {hourData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hourData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="hora"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatTiempo(v)}
                width={52}
              />
              <Tooltip content={<TimeTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line
                type="monotone"
                dataKey="Cocina"
                stroke={COLOR_COCINA}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: COLOR_COCINA, strokeWidth: 0 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="Barra"
                stroke={COLOR_BARRA}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: COLOR_BARRA, strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-300 text-xs py-16 text-center">Sin registros en el período</p>
        )}
      </div>

      {/* Tiempo medio por día de la semana */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">
          Tiempo medio por día de la semana
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weekData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatTiempo(v)}
              width={52}
            />
            <Tooltip content={<TimeTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Cocina" fill={COLOR_COCINA} radius={[3, 3, 0, 0]} maxBarSize={24} />
            <Bar dataKey="Barra" fill={COLOR_BARRA} radius={[3, 3, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 10 pedidos más lentos */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          10 pedidos más lentos
        </h2>
        <p className="text-xs text-slate-400 mb-4">Período seleccionado</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4 w-6">#</th>
                <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Pedido</th>
                <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Empresa / Cliente</th>
                <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Pantalla</th>
                <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Productos</th>
                <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Fecha</th>
                <th className="text-right text-xs text-slate-500 font-medium pb-2">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {top10Lentos.length > 0 ? top10Lentos.map((t, i) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-2.5 pr-4 text-xs text-slate-400">{i + 1}</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">#{t.pedido_id}</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-800 font-medium">
                    {t.pedidos?.empresa ?? t.pedidos?.nombre ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      t.pantalla === 'cocina'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {t.pantalla}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500 max-w-xs truncate">
                    {productosByPedido.get(t.pedido_id) ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(t.iniciado_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={`text-xs font-bold ${
                      t.tiempo_segundos > 900
                        ? 'text-red-500'
                        : t.tiempo_segundos > 600
                        ? 'text-amber-500'
                        : 'text-slate-700'
                    }`}>
                      {formatTiempo(t.tiempo_segundos)}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-300">
                    Sin registros en el período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
