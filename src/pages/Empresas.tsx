import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Empresa } from '../types/database'

const WEB_BASE = 'https://wurkopadel.vercel.app'

async function fetchEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('nombre', { ascending: true })
  if (error) throw error
  return data as Empresa[]
}

async function toggleField(id: string, field: 'activa' | 'mostrar_nombre', value: boolean) {
  const { error } = await supabase
    .from('empresas')
    .update({ [field]: value })
    .eq('id', id)
  if (error) throw error
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-500 hover:bg-slate-50 transition-colors shrink-0"
    >
      {copied ? '✓ Copiado' : 'Copiar URL'}
    </button>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </div>
      <span className="text-xs text-slate-600">{label}</span>
    </label>
  )
}

export default function Empresas() {
  const queryClient = useQueryClient()

  const { data: empresas = [], isLoading } = useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: fetchEmpresas,
  })

  const handleToggle = async (empresa: Empresa, field: 'activa' | 'mostrar_nombre', value: boolean) => {
    queryClient.setQueryData<Empresa[]>(['empresas'], (prev) =>
      prev?.map((e) => (e.id === empresa.id ? { ...e, [field]: value } : e)) ?? []
    )
    try {
      await toggleField(empresa.id, field, value)
    } catch {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Empresas</h1>
      <p className="text-slate-500 text-sm mb-5">
        Empresas registradas con acceso a la web de pedidos.
      </p>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : empresas.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay empresas registradas.</p>
      ) : (
        <div className="space-y-3">
          {empresas.map((empresa) => {
            const url = `${WEB_BASE}?empresa=${empresa.token_acceso}`
            return (
              <div
                key={empresa.id}
                className={`bg-white border rounded-xl p-4 transition-opacity ${!empresa.activa ? 'opacity-60' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{empresa.nombre}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {empresa.activa ? 'Activa' : 'Inactiva'} · creada {new Date(empresa.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Toggle
                      checked={empresa.activa}
                      onChange={(v) => handleToggle(empresa, 'activa', v)}
                      label="Activa"
                    />
                    <Toggle
                      checked={empresa.mostrar_nombre ?? false}
                      onChange={(v) => handleToggle(empresa, 'mostrar_nombre', v)}
                      label="Mostrar nombre"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">URL de acceso / QR</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-600 font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 flex-1 truncate">
                        {url}
                      </p>
                      <CopyButton text={url} />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {empresa.envio_gratis ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Envío gratis
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        Envío {empresa.coste_envio.toFixed(2)}€
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
