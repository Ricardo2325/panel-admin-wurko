import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Empresa } from '../types/database'

const WEB_BASE = 'https://wurkopadel.vercel.app'

function randomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function pedidoUrl(token: string): string {
  return `${WEB_BASE}/pedido?empresa=${token}`
}

function qrUrl(token: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pedidoUrl(token))}`
}

async function fetchEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data
}

async function saveEmpresa(emp: Partial<Empresa> & { id?: string }): Promise<void> {
  if (emp.id) {
    const { error } = await supabase.from('empresas').update(emp).eq('id', emp.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('empresas').insert(emp)
    if (error) throw error
  }
}

async function toggleActiva(id: string, activa: boolean): Promise<void> {
  const { error } = await supabase.from('empresas').update({ activa }).eq('id', id)
  if (error) throw error
}

// ── Modal QR ──────────────────────────────────────────────────────────────────

function QRModal({ empresa, onClose }: { empresa: Empresa; onClose: () => void }) {
  const url = pedidoUrl(empresa.token_acceso)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-1">{empresa.nombre}</h2>
        <p className="text-xs text-slate-500 mb-4 break-all">{url}</p>
        <div className="flex justify-center mb-4">
          <img src={qrUrl(empresa.token_acceso)} alt="QR" className="w-56 h-56 rounded-lg border border-slate-200" />
        </div>
        <div className="flex gap-2">
          <a
            href={qrUrl(empresa.token_acceso)}
            download={`QR_${empresa.nombre}.png`}
            className="flex-1 text-center bg-slate-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-slate-700"
          >
            Descargar QR
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal formulario ──────────────────────────────────────────────────────────

interface FormState {
  nombre: string
  token_acceso: string
  envio_gratis: boolean
  coste_envio: string
  activa: boolean
}

function EmpresaModal({
  empresa,
  onClose,
  onSave,
  saving,
}: {
  empresa: Partial<Empresa> | null
  onClose: () => void
  onSave: (data: Partial<Empresa>) => void
  saving: boolean
}) {
  const isNew = !empresa?.id
  const [form, setForm] = useState<FormState>({
    nombre:       empresa?.nombre       ?? '',
    token_acceso: empresa?.token_acceso ?? randomToken(),
    envio_gratis: empresa?.envio_gratis ?? false,
    coste_envio:  String(empresa?.coste_envio ?? '0'),
    activa:       empresa?.activa       ?? true,
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (!form.nombre.trim()) return
    onSave({
      ...(empresa?.id ? { id: empresa.id } : {}),
      nombre:       form.nombre.trim(),
      token_acceso: form.token_acceso.trim().toUpperCase(),
      envio_gratis: form.envio_gratis,
      coste_envio:  parseFloat(form.coste_envio) || 0,
      activa:       form.activa,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-5">
          {isNew ? 'Nueva empresa' : 'Editar empresa'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input
              autoFocus
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Coferdroza"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Token de acceso *</label>
            <div className="flex gap-2">
              <input
                value={form.token_acceso}
                onChange={(e) => set('token_acceso', e.target.value.toUpperCase())}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="COFERD01"
              />
              <button
                onClick={() => set('token_acceso', randomToken())}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
              >
                Generar
              </button>
            </div>
            {form.token_acceso && (
              <p className="text-xs text-slate-400 mt-1 break-all">
                {pedidoUrl(form.token_acceso)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="envio_gratis"
              checked={form.envio_gratis}
              onChange={(e) => set('envio_gratis', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="envio_gratis" className="text-sm text-slate-700">Envío gratis</label>
          </div>

          {!form.envio_gratis && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Coste de envío (€)</label>
              <input
                type="number"
                min="0"
                step="0.10"
                value={form.coste_envio}
                onChange={(e) => set('coste_envio', e.target.value)}
                className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="activa"
              checked={form.activa}
              onChange={(e) => set('activa', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="activa" className="text-sm text-slate-700">Empresa activa</label>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving || !form.nombre.trim()}
            className="flex-1 bg-slate-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isNew ? 'Crear empresa' : 'Guardar cambios'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Empresas() {
  const queryClient = useQueryClient()
  const [modalEmpresa, setModalEmpresa] = useState<Partial<Empresa> | null | false>(false)
  const [qrEmpresa,    setQrEmpresa]    = useState<Empresa | null>(null)
  const [copied,       setCopied]       = useState<string | null>(null)

  const { data: empresas = [], isLoading } = useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: fetchEmpresas,
  })

  const saveMutation = useMutation({
    mutationFn: saveEmpresa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      setModalEmpresa(false)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) => toggleActiva(id, activa),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['empresas'] }),
  })

  function copyLink(token: string) {
    navigator.clipboard.writeText(pedidoUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de empresas del polígono y sus QR.</p>
        </div>
        <button
          onClick={() => setModalEmpresa({})}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700"
        >
          + Nueva empresa
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : empresas.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">Sin empresas todavía.</p>
          <button onClick={() => setModalEmpresa({})} className="mt-3 text-sm text-slate-600 underline">
            Crear la primera
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {empresas.map((emp) => (
            <div
              key={emp.id}
              className={`bg-white border rounded-xl px-5 py-4 flex items-center gap-4 ${emp.activa ? 'border-slate-200' : 'border-slate-200 opacity-50'}`}
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{emp.nombre}</span>
                  {emp.activa
                    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activa</span>
                    : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactiva</span>
                  }
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-mono text-slate-500">Token: {emp.token_acceso}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500">
                    {emp.envio_gratis ? 'Envío gratis' : `Envío: ${emp.coste_envio.toFixed(2)}€`}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setQrEmpresa(emp)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
                >
                  Ver QR
                </button>
                <button
                  onClick={() => copyLink(emp.token_acceso)}
                  className={`px-3 py-1.5 border rounded-lg text-xs transition-colors ${
                    copied === emp.token_acceso
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {copied === emp.token_acceso ? '✓ Copiado' : 'Copiar link'}
                </button>
                <button
                  onClick={() => setModalEmpresa(emp)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleMutation.mutate({ id: emp.id, activa: !emp.activa })}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-500 hover:bg-slate-50"
                >
                  {emp.activa ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      {modalEmpresa !== false && (
        <EmpresaModal
          empresa={modalEmpresa}
          onClose={() => setModalEmpresa(false)}
          onSave={(data) => saveMutation.mutate(data)}
          saving={saveMutation.isPending}
        />
      )}

      {/* Modal QR */}
      {qrEmpresa && (
        <QRModal empresa={qrEmpresa} onClose={() => setQrEmpresa(null)} />
      )}
    </div>
  )
}
