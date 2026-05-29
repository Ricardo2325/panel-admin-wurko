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

async function fetchPedidosAnalytics(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('empresa, total, estado, created_at, forma_pago, zona')
    .neq('estado', 'cancelado')
    .order('created_at', { ascending: false })
    .limit(3000)
  if (error) throw error
  return (data ?? []) as Pedido[]
}

function formatEuro(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
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

  // Filtrar por período seleccionado
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - period)
  const pedidos = allPedidos.filter((p: Pedido) => new Date(p.created_at) >= cutoff)

  // ── KPIs ──
  const totalFacturado = pedidos.reduce((s: number, p: Pedido) => s + (p.total ?? 0), 0)
  const totalPedidos = pedidos.length
  const ticketMedio = totalPedidos > 0 ? totalFacturado / totalPedidos : 0

  // ── Facturación diaria (AreaChart) ──
  const diaMap = new Map<string, number>()
  for (const p of pedidos) {
    const key = new Date(p.created_at).toISOString().slice(0, 10)
    diaMap.set(key, (diaMap.get(key) ?? 0) + (p.total ?? 0))
  }
  const dailyData = Array.from({ length: period }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (period - 1 - i))
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    return { date: label, Facturación: Math.round((diaMap.get(key) ?? 0) * 100) / 100 }
  })

  // ── Pedidos por hora (BarChart) ──
  const horaMap = new Map<number, number>()
  for (const p of pedidos) {
    const h = new Date(p.created_at).getHours()
    horaMap.set(h, (horaMap.get(h) ?? 0) + 1)
  }
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hora: `${String(h).padStart(2, '0')}h`,
    Pedidos: horaMap.get(h) ?? 0,
  })).filter((d) => d.Pedidos > 0)

  // ── Métodos de pago (PieChart) ──
  const pagoMap = new Map<string, number>()
  for (const p of pedidos) {
    const key = p.forma_pago?.trim() || 'Sin datos'
    pagoMap.set(key, (pagoMap.get(key) ?? 0) + 1)
  }
  const paymentData = [...pagoMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  // ── Top empresas por facturación (BarChart horizontal) ──
  const empresaMap = new Map<string, { pedidos: number; facturado: number }>()
  for (const p of pedidos) {
    const key = p.empresa?.trim() || 'Particular'
    const prev = empresaMap.get(key) ?? { pedidos: 0, facturado: 0 }
    empresaMap.set(key, { pedidos: prev.pedidos + 1, facturado: prev.facturado + (p.total ?? 0) })
  }
  const topEmpresas = [...empresaMap.entries()]
    .sort((a, b) => b[1].facturado - a[1].facturado)
    .slice(0, 8)
    .map(([nombre, stats]) => ({
      nombre: nombre.length > 18 ? nombre.slice(0, 18) + '…' : nombre,
      Facturación: Math.round(stats.facturado),
      Pedidos: stats.pedidos,
    }))
    .reverse()

  // ── Top zonas (BarChart horizontal) ──
  const zonaMap = new Map<string, number>()
  for (const p of pedidos) {
    const key = p.zona?.trim() || 'Sin zona'
    zonaMap.set(key, (zonaMap.get(key) ?? 0) + 1)
  }
  const topZonas = [...zonaMap.entries()]
    .filter(([z]) => z !== 'Sin zona')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([zona, count]) => ({ zona, Pedidos: count }))
    .reverse()

  // Calcular tick interval para eje X del gráfico diario
  const xInterval = period <= 14 ? 0 : period <= 30 ? 3 : 6

  return (
    <div>
      {/* Header con selector de período */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Resumen de actividad del chatbot</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {([7, 14, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-1">Total facturado</p>
          <p className="text-2xl font-bold text-slate-900">{formatEuro(totalFacturado)}</p>
          <p className="text-xs text-slate-400 mt-1">Últimos {period} días</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-1">Pedidos procesados</p>
          <p className="text-2xl font-bold text-slate-900">{totalPedidos.toLocaleString('es-ES')}</p>
          <p className="text-xs text-slate-400 mt-1">Últimos {period} días</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-1">Ticket medio</p>
          <p className="text-2xl font-bold text-slate-900">{formatEuro(ticketMedio)}</p>
          <p className="text-xs text-slate-400 mt-1">Por pedido</p>
        </div>
      </div>

      {/* Facturación diaria — AreaChart */}
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
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval={xInterval}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}€`}
              width={50}
            />
            <Tooltip content={<EuroTooltip />} />
            <Area
              type="monotone"
              dataKey="Facturación"
              stroke="#0f172a"
              strokeWidth={2}
              fill="url(#gradRevenue)"
              dot={false}
              activeDot={{ r: 4, fill: '#0f172a', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Pedidos por hora + Métodos de pago */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Pedidos por hora — BarChart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Pedidos por hora</h2>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="hora"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="Pedidos" fill="#0f172a" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-xs py-16 text-center">Sin datos en este período</p>
          )}
        </div>

        {/* Métodos de pago — PieChart donut */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Métodos de pago</h2>
          {paymentData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                <PieChart width={150} height={150}>
                  <Pie
                    data={paymentData}
                    cx={70}
                    cy={70}
                    innerRadius={42}
                    outerRadius={68}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} ped.`} />
                </PieChart>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {paymentData.map(({ name, value }, i) => {
                  const pct = totalPedidos > 0 ? Math.round((value / totalPedidos) * 100) : 0
                  return (
                    <div key={name} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-slate-700 flex-1 truncate">{name}</span>
                      <span className="text-slate-500 font-semibold shrink-0">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-xs py-16 text-center">Sin datos en este período</p>
          )}
        </div>
      </div>

      {/* Top empresas + Top zonas */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top empresas por facturación — BarChart horizontal */}
        {topEmpresas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Top empresas</h2>
            <ResponsiveContainer width="100%" height={Math.max(topEmpresas.length * 34, 80)}>
              <BarChart
                data={topEmpresas}
                layout="vertical"
                margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}€`}
                />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip content={<EuroTooltip />} />
                <Bar dataKey="Facturación" fill="#3b82f6" radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top zonas — BarChart horizontal */}
        {topZonas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Pedidos por zona</h2>
            <ResponsiveContainer width="100%" height={Math.max(topZonas.length * 34, 80)}>
              <BarChart
                data={topZonas}
                layout="vertical"
                margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="zona"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="Pedidos" fill="#10b981" radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
