import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { Pedido } from '../types/database'

type Period = 7 | 14 | 30 | 90

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
const ESTADO_COLORS: Record<string, string> = {
  entregado: '#10b981',
  confirmado: '#3b82f6',
  pendiente: '#f59e0b',
  cancelado: '#ef4444',
}
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

async function fetchPedidosAnalytics(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('empresa, total, estado, created_at, forma_pago, zona, nombre, telefono')
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  return (data ?? []) as Pedido[]
}

function formatEuro(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function trendPct(current: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((current - prev) / prev) * 100)
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  )
}

function EuroTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((e) => (
        <p key={e.name} className="font-semibold" style={{ color: e.color }}>{formatEuro(e.value)}</p>
      ))}
    </div>
  )
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((e) => (
        <p key={e.name} className="font-semibold" style={{ color: e.color }}>{e.value} pedidos</p>
      ))}
    </div>
  )
}

function HBarChart({ data, dataKey, color, valueFormatter }: {
  data: Record<string, string | number>[]
  dataKey: string
  color: string
  valueFormatter?: (v: number) => string
}) {
  if (!data.length) return <p className="text-slate-400 text-xs py-8 text-center">Sin datos</p>
  const labelKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'string') ?? ''
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 34, 80)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 55, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
          tickFormatter={valueFormatter ?? ((v: number) => String(v))} />
        <YAxis type="category" dataKey={labelKey} tick={{ fontSize: 11, fill: '#475569' }}
          tickLine={false} axisLine={false} width={110} />
        <Tooltip formatter={(v) => valueFormatter ? valueFormatter(v as number) : v} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 3, 3, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>(30)

  const { data: allPedidos = [], isLoading } = useQuery<Pedido[]>({
    queryKey: ['pedidos-analytics'],
    queryFn: fetchPedidosAnalytics,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 text-sm">Cargando dashboard...</p>
      </div>
    )
  }

  // ── Períodos ──
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period)
  const cutoffPrev = new Date(); cutoffPrev.setDate(cutoffPrev.getDate() - period * 2)

  const allInPeriod = allPedidos.filter((p: Pedido) => new Date(p.created_at) >= cutoff)
  const pedidos = allInPeriod.filter((p: Pedido) => p.estado !== 'cancelado')

  const prevPedidos = allPedidos.filter((p: Pedido) =>
    new Date(p.created_at) >= cutoffPrev &&
    new Date(p.created_at) < cutoff &&
    p.estado !== 'cancelado'
  )

  // ── KPIs ──
  const totalFacturado = pedidos.reduce((s: number, p: Pedido) => s + (p.total ?? 0), 0)
  const totalPedidos = pedidos.length
  const ticketMedio = totalPedidos > 0 ? totalFacturado / totalPedidos : 0
  const clientesUnicos = new Set(pedidos.map((p: Pedido) => p.telefono?.trim()).filter(Boolean)).size

  const prevFacturado = prevPedidos.reduce((s: number, p: Pedido) => s + (p.total ?? 0), 0)
  const prevCount = prevPedidos.length
  const prevTicket = prevCount > 0 ? prevFacturado / prevCount : 0
  const prevClientes = new Set(prevPedidos.map((p: Pedido) => p.telefono?.trim()).filter(Boolean)).size

  // ── Estado de pedidos ──
  const estadoMap = new Map<string, number>()
  for (const p of allInPeriod) {
    const key = p.estado?.trim() || 'sin estado'
    estadoMap.set(key, (estadoMap.get(key) ?? 0) + 1)
  }
  const estadoData = [...estadoMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))
  const cancelados = estadoMap.get('cancelado') ?? 0
  const tasaCancelacion = allInPeriod.length > 0
    ? Math.round((cancelados / allInPeriod.length) * 100)
    : 0

  // ── Facturación diaria ──
  const diaMap = new Map<string, number>()
  for (const p of pedidos) {
    const key = new Date(p.created_at).toISOString().slice(0, 10)
    diaMap.set(key, (diaMap.get(key) ?? 0) + (p.total ?? 0))
  }
  const dailyData = Array.from({ length: period }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (period - 1 - i))
    const key = d.toISOString().slice(0, 10)
    return {
      date: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      Facturación: Math.round((diaMap.get(key) ?? 0) * 100) / 100,
    }
  })

  // ── Pedidos por hora ──
  const horaMap = new Map<number, number>()
  for (const p of pedidos) {
    const h = new Date(p.created_at).getHours()
    horaMap.set(h, (horaMap.get(h) ?? 0) + 1)
  }
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hora: `${String(h).padStart(2, '0')}h`,
    Pedidos: horaMap.get(h) ?? 0,
  })).filter((d) => d.Pedidos > 0)

  // ── Pedidos por día de la semana (Lun→Dom) ──
  const weekMap = new Map<number, number>()
  for (const p of pedidos) {
    const d = new Date(p.created_at).getDay()
    weekMap.set(d, (weekMap.get(d) ?? 0) + 1)
  }
  const weekdayData = [1, 2, 3, 4, 5, 6, 0].map(i => ({
    dia: DIAS_SEMANA[i],
    Pedidos: weekMap.get(i) ?? 0,
  }))

  // ── Métodos de pago ──
  const pagoMap = new Map<string, number>()
  for (const p of pedidos) {
    const key = p.forma_pago?.trim() || 'Sin datos'
    pagoMap.set(key, (pagoMap.get(key) ?? 0) + 1)
  }
  const paymentData = [...pagoMap.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  // ── Top empresas ──
  const empresaMap = new Map<string, { pedidos: number; facturado: number }>()
  for (const p of pedidos) {
    const key = p.empresa?.trim() || 'Particular'
    const prev = empresaMap.get(key) ?? { pedidos: 0, facturado: 0 }
    empresaMap.set(key, { pedidos: prev.pedidos + 1, facturado: prev.facturado + (p.total ?? 0) })
  }
  const topEmpresasFact = [...empresaMap.entries()]
    .sort((a, b) => b[1].facturado - a[1].facturado).slice(0, 7)
    .map(([n, s]) => ({ nombre: n.length > 16 ? n.slice(0, 16) + '…' : n, Facturación: Math.round(s.facturado) }))
    .reverse()

  const topEmpresasPed = [...empresaMap.entries()]
    .sort((a, b) => b[1].pedidos - a[1].pedidos).slice(0, 7)
    .map(([n, s]) => ({ nombre: n.length > 16 ? n.slice(0, 16) + '…' : n, Pedidos: s.pedidos }))
    .reverse()

  // ── Ticket medio por empresa (mín. 3 pedidos) ──
  const ticketEmpresas = [...empresaMap.entries()]
    .filter(([_, s]) => s.pedidos >= 3)
    .sort((a, b) => (b[1].facturado / b[1].pedidos) - (a[1].facturado / a[1].pedidos))
    .slice(0, 6)
    .map(([n, s]) => ({ nombre: n.length > 16 ? n.slice(0, 16) + '…' : n, 'Ticket medio': Math.round(s.facturado / s.pedidos) }))
    .reverse()

  // ── Top clientes ──
  const clienteMap = new Map<string, number>()
  for (const p of pedidos) {
    const key = p.nombre?.trim()
    if (!key || key.length < 2) continue
    clienteMap.set(key, (clienteMap.get(key) ?? 0) + 1)
  }
  const topClientes = [...clienteMap.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([n, count]) => ({ cliente: n.length > 16 ? n.slice(0, 16) + '…' : n, Pedidos: count }))
    .reverse()

  // ── Top zonas ──
  const zonaMap = new Map<string, number>()
  for (const p of pedidos) {
    const key = p.zona?.trim() || 'Sin zona'
    zonaMap.set(key, (zonaMap.get(key) ?? 0) + 1)
  }
  const topZonas = [...zonaMap.entries()]
    .filter(([z]) => z !== 'Sin zona')
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([zona, count]) => ({ zona, Pedidos: count }))
    .reverse()

  const xInterval = period <= 14 ? 0 : period <= 30 ? 3 : 6
  const noPedidos = pedidos.length === 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Resumen de actividad del chatbot</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {([7, 14, 30, 90] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total facturado', value: formatEuro(totalFacturado), trend: trendPct(totalFacturado, prevFacturado), sub: `vs. ${period}d anteriores` },
          { label: 'Pedidos', value: totalPedidos.toLocaleString('es-ES'), trend: trendPct(totalPedidos, prevCount), sub: `vs. ${period}d anteriores` },
          { label: 'Ticket medio', value: formatEuro(ticketMedio), trend: trendPct(ticketMedio, prevTicket), sub: 'por pedido' },
          { label: 'Clientes únicos', value: clientesUnicos.toLocaleString('es-ES'), trend: trendPct(clientesUnicos, prevClientes), sub: 'teléfonos distintos' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-slate-400">{kpi.sub}</p>
              <TrendBadge pct={kpi.trend} />
            </div>
          </div>
        ))}
      </div>

      {/* Tasa cancelación mini-stat */}
      {!noPedidos && (
        <div className="flex gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-slate-500">Tasa de cancelación</span>
            <span className={`text-sm font-bold ${tasaCancelacion > 10 ? 'text-red-500' : 'text-slate-800'}`}>{tasaCancelacion}%</span>
          </div>
          {topEmpresasPed.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xs text-slate-500">Empresa top</span>
              <span className="text-sm font-bold text-slate-800">
                {[...empresaMap.entries()].sort((a, b) => b[1].pedidos - a[1].pedidos)[0]?.[0] ?? '—'}
              </span>
              <span className="text-xs text-slate-400">
                ({[...empresaMap.entries()].sort((a, b) => b[1].pedidos - a[1].pedidos)[0]?.[1].pedidos ?? 0} pedidos)
              </span>
            </div>
          )}
        </div>
      )}

      {noPedidos && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <p className="text-amber-700 text-sm">No hay pedidos en los últimos {period} días. Prueba seleccionar un período mayor.</p>
        </div>
      )}
      <>

          {/* Facturación diaria */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Facturación diaria</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={xInterval} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}€`} width={50} />
                <Tooltip content={<EuroTooltip />} />
                <Area type="monotone" dataKey="Facturación" stroke="#0f172a" strokeWidth={2}
                  fill="url(#gradRevenue)" dot={false} activeDot={{ r: 4, fill: '#0f172a', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pedidos por hora + Día de la semana */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Pedidos por hora</h2>
              {hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CountTooltip />} />
                    <Bar dataKey="Pedidos" fill="#0f172a" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-400 text-xs py-16 text-center">Sin datos</p>}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Pedidos por día de la semana</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weekdayData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CountTooltip />} />
                  <Bar dataKey="Pedidos" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Métodos de pago + Estado de pedidos */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Métodos de pago</h2>
              {paymentData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <PieChart width={150} height={150}>
                      <Pie data={paymentData} cx={70} cy={70} innerRadius={42} outerRadius={68}
                        dataKey="value" paddingAngle={2}>
                        {paymentData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${v} ped.`} />
                    </PieChart>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {paymentData.map(({ name, value }, i) => (
                      <div key={name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-slate-700 flex-1 truncate">{name}</span>
                        <span className="text-slate-500 font-semibold shrink-0">
                          {totalPedidos > 0 ? Math.round((value / totalPedidos) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-slate-400 text-xs py-16 text-center">Sin datos</p>}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Estado de pedidos</h2>
              {estadoData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <PieChart width={150} height={150}>
                      <Pie data={estadoData} cx={70} cy={70} innerRadius={42} outerRadius={68}
                        dataKey="value" paddingAngle={2}>
                        {estadoData.map((entry, i) => (
                          <Cell key={i} fill={ESTADO_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${v} pedidos`} />
                    </PieChart>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {estadoData.map((entry, i) => {
                      const total = allInPeriod.length
                      return (
                        <div key={entry.name} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: ESTADO_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-slate-700 flex-1 capitalize">{entry.name}</span>
                          <span className="text-slate-500 font-semibold shrink-0">
                            {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : <p className="text-slate-400 text-xs py-16 text-center">Sin datos</p>}
            </div>
          </div>

          {/* Top empresas por facturación + por número de pedidos */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Empresas — más facturación</h2>
              <HBarChart data={topEmpresasFact} dataKey="Facturación" color="#3b82f6" valueFormatter={formatEuro} />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Empresas — más pedidos</h2>
              <HBarChart data={topEmpresasPed} dataKey="Pedidos" color="#0f172a" />
            </div>
          </div>

          {/* Top clientes + Ticket medio por empresa */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {topClientes.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-800 mb-4">Clientes más frecuentes</h2>
                <HBarChart data={topClientes} dataKey="Pedidos" color="#f59e0b" />
              </div>
            )}
            {ticketEmpresas.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-800 mb-4">Ticket medio por empresa</h2>
                <p className="text-xs text-slate-400 mb-3">Solo empresas con 3+ pedidos</p>
                <HBarChart data={ticketEmpresas} dataKey="Ticket medio" color="#10b981" valueFormatter={formatEuro} />
              </div>
            )}
          </div>

          {/* Top zonas */}
          {topZonas.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Pedidos por zona</h2>
              <HBarChart data={topZonas} dataKey="Pedidos" color="#06b6d4" />
            </div>
          )}
      </>
    </div>
  )
}
