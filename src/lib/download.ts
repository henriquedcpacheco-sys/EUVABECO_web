import JSZip from 'jszip'
import type { Comparison } from './data'
import { paramSymbol } from './model'

type Cell = string | number | null | undefined

export function toCsv(header: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    if (v == null || (typeof v === 'number' && Number.isNaN(v))) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header, ...rows].map(r => r.map(esc).join(',')).join('\n') + '\n'
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export const saveText = (text: string, name: string, type = 'text/csv') =>
  saveBlob(new Blob([text], { type }), name)

export async function saveZip(name: string, files: Record<string, string | Blob>) {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) zip.file(path, content)
  saveBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), name)
}

/** The all-models comparison table: parameters and fit errors as rows,
 * one column per model (blank where a parameter is not in that model). */
export function comparisonCsv(c: Comparison): string {
  const models = Object.keys(c.models)
  const rows: Cell[][] = c.order.map(p => [paramSymbol(p), ...models.map(m => c.models[m].params[p])])
  rows.push(['Number of estimated parameters', ...models.map(m => c.models[m].nEst)])
  for (const [k, label] of [['cases', 'J — cases'], ['ward', 'J — ward'], ['icu', 'J — ICU'],
    ['deaths', 'J — deaths'], ['total', 'J — total']] as const) {
    rows.push([label, ...models.map(m => c.models[m].J[k])])
  }
  return toCsv(['Parameter / error', ...models], rows)
}
