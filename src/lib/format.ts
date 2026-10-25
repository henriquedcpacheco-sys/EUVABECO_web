const pad = (n: number) => String(n).padStart(2, '0')

/** dd/mm/yyyy of a UTC timestamp. */
export function fmtDate(t: number): string {
  const d = new Date(t)
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

/** yyyy-mm-dd of a UTC timestamp (for <input type="date"> and CSVs). */
export function isoDate(t: number): string {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const parseIso = (s: string) => Date.parse(s + 'T00:00:00Z')

const intFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
export const fmtInt = (v: number) => intFmt.format(Math.round(v))

export function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Significant-digit formatting for parameter values. */
export function fmtSig(v: number | null | undefined, sig = 4): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1000) return fmtInt(v)
  return Number(v.toPrecision(sig)).toString()
}

/** Axis labels: 2500 -> 2.5k, 0.05 -> 0.05. */
export function compact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e6) return `${+(v / 1e6).toPrecision(3)}M`
  if (a >= 1000) return `${+(v / 1000).toPrecision(3)}k`
  return `${+v.toPrecision(3)}`
}

export function pctChange(v: number, ref: number): number | null {
  return ref === 0 ? null : 100 * (v / ref - 1)
}
