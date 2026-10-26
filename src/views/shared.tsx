import { useState, type ReactNode } from 'react'
import { CalendarDays, HeartPulse, TrendingUp, Users } from 'lucide-react'
import { DataTable, Field, Metric, Segmented, Select } from '../components/ui'
import { ZOOM_HINT } from '../components/EChart'
import { SERIES, SERIES_COLORS, SERIES_COLORS_DARK_MODE, SERIES_LABELS, type Series } from '../lib/model'
import { fmtDate, fmtInt, fmtNum } from '../lib/format'

export function PanelGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 4 }) {
  return (
    <div className="space-y-2">
      <div className={cols === 4 ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4' : 'grid gap-4 lg:grid-cols-2'}>
        {children}
      </div>
      <p className="text-[12.5px] text-muted">{ZOOM_HINT} Use <strong>Enlarge</strong> on a plot to see it bigger.</p>
    </div>
  )
}

export function ChartCard({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-3 pt-3.5 shadow-card">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color ?? 'var(--primary)' }} />
      {children}
    </div>
  )
}

export const seriesColor = (s: Series | 'Rt', mode: 'light' | 'dark') =>
  (mode === 'dark' ? SERIES_COLORS_DARK_MODE : SERIES_COLORS)[s]

// ---------------------------------------------------------------------------
// Overlay: two series on twin y-axes
// ---------------------------------------------------------------------------
export const OV_SERIES: Record<string, Series | 'Rt'> = {
  'Rₜ': 'Rt', 'Daily cases': 'cases', 'General ward': 'ward', ICU: 'icu', 'Daily deaths': 'deaths',
}
const OV_PRESETS: Record<string, [string, string] | null> = {
  'Rₜ vs Daily cases': ['Rₜ', 'Daily cases'],
  'Daily cases vs General ward': ['Daily cases', 'General ward'],
  'Daily cases vs Daily deaths': ['Daily cases', 'Daily deaths'],
  Custom: null,
}

export function useOverlay() {
  const [preset, setPreset] = useState('Rₜ vs Daily cases')
  const [custom, setCustom] = useState<[string, string]>(['Daily cases', 'Daily deaths'])
  const pair = OV_PRESETS[preset] ?? custom
  const picker = (
    <div className="space-y-3">
      <Segmented size="sm" value={preset} onChange={setPreset}
        options={Object.keys(OV_PRESETS).map(k => ({ value: k, label: k }))} />
      {OV_PRESETS[preset] === null && (
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Field label="Left y-axis"><Select value={custom[0]} options={Object.keys(OV_SERIES)} onChange={v => setCustom([v, custom[1]])} /></Field>
          <Field label="Right y-axis"><Select value={custom[1]} options={Object.keys(OV_SERIES)} onChange={v => setCustom([custom[0], v])} /></Field>
        </div>
      )}
    </div>
  )
  return { pair, picker }
}

// ---------------------------------------------------------------------------
// Epidemic metrics of a simulated trajectory
// ---------------------------------------------------------------------------
export interface Metrics {
  days: number
  cases: number
  deaths: number
  rtMax: number
  rtDay: number
  peaks: Record<Series, { value: number; time: number }>
}

/** times/values restricted to [start, end]; rt may have its own time axis. */
export function computeMetrics(times: number[], values: Record<Series, ArrayLike<number>>,
  rtTimes: number[], rt: ArrayLike<number>, start: number, end: number): Metrics {
  const idx = times.map((t, i) => [t, i] as const).filter(([t]) => t >= start && t <= end).map(([, i]) => i)
  const peak = (s: Series) => {
    let best = idx[0]
    for (const i of idx) if (values[s][i] > values[s][best]) best = i
    return { value: values[s][best], time: times[best] }
  }
  let rtMax = -Infinity, rtDay = rtTimes[0]
  rtTimes.forEach((t, i) => { if (t >= start && t <= end && rt[i] > rtMax) { rtMax = rt[i]; rtDay = t } })
  const sum = (s: Series) => idx.reduce((a, i) => a + values[s][i], 0)
  return {
    days: idx.length, cases: sum('cases'), deaths: sum('deaths'), rtMax, rtDay,
    peaks: Object.fromEntries(SERIES.map(s => [s, peak(s)])) as Metrics['peaks'],
  }
}

export function metricsCsvRows(m: Metrics): (string | number)[][] {
  return [
    ['Days simulated', m.days],
    ['Total confirmed cases', Math.round(m.cases)],
    ['Total deaths', Math.round(m.deaths)],
    [`Highest Rt (${fmtDate(m.rtDay)})`, +m.rtMax.toFixed(3)],
    ...SERIES.map(s => [`Peak ${SERIES_LABELS[s]} (${fmtDate(m.peaks[s].time)})`, Math.round(m.peaks[s].value)]),
  ]
}

export function MetricsView({ m, intro }: { m: Metrics; intro?: ReactNode }) {
  return (
    <div className="space-y-5">
      {intro && <p className="text-[14px] text-ink-2">{intro}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Days simulated" value={m.days} icon={CalendarDays} />
        <Metric label="Total confirmed cases" value={fmtInt(m.cases)} color={SERIES_COLORS.cases} icon={Users} />
        <Metric label="Total deaths" value={fmtInt(m.deaths)} color={SERIES_COLORS.deaths} icon={HeartPulse} />
        <Metric label="Highest Rₜ" value={fmtNum(m.rtMax, 2)} sub={`on ${fmtDate(m.rtDay)}`} color={SERIES_COLORS.Rt} icon={TrendingUp} />
      </div>
      <div>
        <h4 className="mb-2 text-[14px] font-semibold">Peak of each series</h4>
        <DataTable
          columns={[
            { key: 'series', label: 'Series', render: r => <span className="inline-flex items-center gap-2 font-medium"><span className="size-2.5 rounded-full" style={{ background: SERIES_COLORS[r.key as Series] }} />{r.series as string}</span> },
            { key: 'day', label: 'Peak day', align: 'right' },
            { key: 'value', label: 'Peak value', align: 'right' },
          ]}
          rows={SERIES.map(s => ({ key: s, series: SERIES_LABELS[s], day: fmtDate(m.peaks[s].time), value: fmtInt(m.peaks[s].value) }))}
        />
      </div>
    </div>
  )
}
