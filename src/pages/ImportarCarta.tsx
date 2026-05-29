import { useRef, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Producto } from '../types/database'

interface FilaXLS {
  nombre: string
  familia: string
  precioRaw: number | null
  precio: number | null // en euros
}

interface ResultadoMatch {
  fila: FilaXLS
  productoExistente: Producto | null
  precioAnterior: number | null
  actualizar: boolean
}

async function fetchProductos(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, precio, categoria, activo, created_at')
  if (error) throw error
  return (data ?? []) as Producto[]
}

async function actualizarPrecios(items: { id: number; precio: number }[]): Promise<void> {
  // Supabase no tiene batch update nativo — usamos Promise.all con lotes de 50
  const LOTE = 50
  for (let i = 0; i < items.length; i += LOTE) {
    const lote = items.slice(i, i + LOTE)
    await Promise.all(
      lote.map(({ id, precio }) =>
        supabase.from('productos').update({ precio }).eq('id', id)
      )
    )
  }
}

function parsearXLS(buffer: ArrayBuffer): FilaXLS[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as unknown[][]

  // Detectar índice de columnas por nombre en la cabecera
  const header = rows[0] as string[]
  const idxNombre = header.findIndex(h => h === 'Nombre')
  const idxFamilia = header.findIndex(h => h === 'Familia')
  const idxPrecio = header.findIndex(h => h?.includes('PVP1 Pri'))

  if (idxNombre === -1 || idxPrecio === -1) {
    throw new Error('El archivo no tiene las columnas esperadas (Nombre, Pr. PVP1 Pri.)')
  }

  return rows
    .slice(1)
    .filter(row => row[idxNombre]) // eliminar filas vacías
    .map(row => {
      const precioRaw = row[idxPrecio] as number | null
      return {
        nombre: String(row[idxNombre]).trim(),
        familia: String(row[idxFamilia] ?? '').trim(),
        precioRaw: precioRaw ?? null,
        precio: precioRaw ? +(precioRaw / 100).toFixed(2) : null,
      }
    })
    .filter(f => f.precio !== null && f.precio > 0) // solo con precio válido
}

function normalizar(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

export default function ImportarCarta() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [resultados, setResultados] = useState<ResultadoMatch[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [dragging, setDragging] = useState(false)
  const queryClient = useQueryClient()

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ['productos'],
    queryFn: fetchProductos,
  })

  const mutation = useMutation({
    mutationFn: actualizarPrecios,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      setDone(true)
    },
  })

  function procesarArchivo(file: File) {
    setParseError(null)
    setDone(false)
    setResultados(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const filas = parsearXLS(ev.target!.result as ArrayBuffer)

        // Crear mapa de productos por nombre normalizado
        const mapaProductos = new Map<string, Producto>(
          productos.map((p: Producto) => [normalizar(p.nombre), p])
        )

        const matches: ResultadoMatch[] = filas.map(fila => {
          const existente = mapaProductos.get(normalizar(fila.nombre)) ?? null
          return {
            fila,
            productoExistente: existente,
            precioAnterior: existente?.precio ?? null,
            actualizar: existente !== null && fila.precio !== existente?.precio,
          }
        })

        setResultados(matches)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Error al leer el archivo')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) procesarArchivo(file)
  }, [productos])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const aActualizar = resultados?.filter(r => r.actualizar) ?? []
  const sinMatch = resultados?.filter(r => !r.productoExistente) ?? []
  const sinCambio = resultados?.filter(r => r.productoExistente && !r.actualizar) ?? []

  function confirmar() {
    const items = aActualizar
      .filter(r => r.productoExistente && r.fila.precio !== null)
      .map(r => ({ id: r.productoExistente!.id, precio: r.fila.precio! }))
    mutation.mutate(items)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Importar carta desde XLS</h1>
      <p className="text-slate-500 text-sm mb-6">
        Subí el export de tu panel de casa. Se actualizan solo los productos que ya existen en Supabase, usando el precio PVP1.
      </p>

      {/* Upload con drag & drop */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center mb-6 max-w-lg cursor-pointer transition-colors ${
          dragging
            ? 'border-slate-700 bg-slate-100'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <div className="text-3xl mb-3">📂</div>
        <p className="text-slate-700 font-medium text-sm">
          {dragging ? 'Suelta el archivo aquí' : 'Arrastra el XLS aquí o haz clic para elegirlo'}
        </p>
        <p className="text-slate-400 text-xs mt-1">Acepta .xls y .xlsx</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {parseError && (
        <p className="text-red-500 text-sm mb-4">{parseError}</p>
      )}

      {/* Resumen */}
      {resultados && !done && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{aActualizar.length}</p>
              <p className="text-xs text-green-600 mt-0.5">Con cambio de precio</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-slate-700">{sinCambio.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Precio igual, sin cambio</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-700">{sinMatch.length}</p>
              <p className="text-xs text-orange-600 mt-0.5">No existen en Supabase</p>
            </div>
          </div>

          {aActualizar.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800 mb-2">
                Precios que van a cambiar ({aActualizar.length})
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-slate-600">Producto</th>
                      <th className="text-right px-3 py-2 text-slate-600">Antes</th>
                      <th className="text-right px-3 py-2 text-slate-600">Nuevo</th>
                      <th className="text-right px-3 py-2 text-slate-600">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aActualizar.map((r, i) => {
                      const diff = (r.fila.precio! - r.precioAnterior!).toFixed(2)
                      const positivo = r.fila.precio! > r.precioAnterior!
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-800">{r.fila.nombre}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{r.precioAnterior?.toFixed(2)}€</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">{r.fila.precio?.toFixed(2)}€</td>
                          <td className={`px-3 py-2 text-right font-medium ${positivo ? 'text-red-600' : 'text-green-600'}`}>
                            {positivo ? '+' : ''}{diff}€
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={confirmar}
                  disabled={mutation.isPending}
                  className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending
                    ? `Actualizando ${aActualizar.length} productos...`
                    : `Confirmar ${aActualizar.length} cambios`}
                </button>
                <button
                  onClick={() => { setResultados(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {aActualizar.length === 0 && (
            <p className="text-slate-500 text-sm">
              Ningún producto tiene cambio de precio respecto a Supabase.
            </p>
          )}

          {sinMatch.length > 0 && sinMatch.length <= 30 && (
            <details className="text-sm">
              <summary className="text-orange-600 cursor-pointer">
                {sinMatch.length} productos del XLS no existen en Supabase (expandir)
              </summary>
              <ul className="mt-2 space-y-0.5 text-slate-500 pl-4">
                {sinMatch.map((r, i) => (
                  <li key={i}>{r.fila.nombre} <span className="text-slate-400">({r.fila.familia})</span></li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {done && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 max-w-lg">
          <p className="text-green-700 font-semibold">
            ✓ {aActualizar.length} precios actualizados correctamente en Supabase
          </p>
          <button
            onClick={() => { setResultados(null); setDone(false); if (fileRef.current) fileRef.current.value = '' }}
            className="mt-3 text-sm text-green-700 underline"
          >
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}
