import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, FlaskConical, BookmarkPlus, Bookmark, Download, GitCompareArrows, Image as ImageIcon, Play, RefreshCw, SlidersHorizontal, Trash2,
} from 'lucide-react'
import {
  Button, Callout, Card, CheckList, DataTable, DateInput, EmptyState, Field, Legend, RadioCards, RangeSlider,
  Segmented, Slider, Tabs, Toggle, useToast,
} from '../components/ui'
import { EChart, chartTheme, exportPng, useThemeMode } from '../components/EChart'
import { compareChart, overlayChart, timePanel, type Layer, type TipRow, type Window } from '../lib/charts'
import { MODEL_OPTIONS, SERIES, SERIES_SHORT, dayToTime, timeToDay, type Series } from '../lib/model'
import { loadAgeDraws, useData } from '../lib/data'
import {
  FITTED_CP, N_DAYS, fittedSchedule, lockdownSchedule, schoolReopeningSchedule, simulate, type Bands, type ModelInputs,
} from '../lib/simulator'
import { fmtDate, fmtInt, fmtNum, isoDate, parseIso, pctChange } from '../lib/format'
import { saveBlob, saveText, toCsv } from '../lib/download'
import { ChartCard, MetricsView, OV_SERIES, PanelGrid, computeMetrics, seriesColor, useOverlay } from './shared'
import { Loading } from './FitMode'

type ScnModel = 'sim_m1' | 'sim_m2' | 'age_nocorr' | 'age_point'
const SCN_MODELS: { value: ScnModel; choice: keyof typeof MODEL_OPTIONS }[] = [
  { value: 'sim_m1', choice: 'sim_m1' }, { value: 'sim_m2', choice: 'sim_m2' },
  { value: 'age_nocorr', choice: 'age_nocorr' }, { value: 'age_point', choice: 'age_3b' },
]
const short = (m: ScnModel) => MODEL_OPTIONS[SCN_MODELS.find(x => x.value === m)!.choice].short

type ScnType = 'baseline' | 'lockdown' | 'school'
type Scenario =
  | { kind: 'lockdown'; start: number; duration: number; reduction: number }
  | { kind: 'school'; delay: number }
  | null

// The two real lockdowns already in the fitted schedule: an extra lockdown
// cannot overlap either, so only the gaps before/between them are free.
const FREE_ZONES = [
  { label: 'Before the spring lockdown', lo: 0, hi: FITTED_CP[0] },
  { label: 'Between the two lockdowns', lo: FITTED_CP[1], hi: FITTED_CP[3] },
]
// The back-to-school changepoint (14/09/2020) can move later, but not as far
// as the next real changepoint (the Nov 2020 tightening).
const SCHOOL_CP = FITTED_CP[2], NEXT_CP = FITTED_CP[3], MAX_SCHOOL_DELAY = NEXT_CP - SCHOOL_CP - 1
const N_BAND_DRAWS = 500

interface Config { model: ScnModel; scn: Scenario; period: [number, number] }
type Traj = Record<Series | 'Rt', number[]>
interface Saved { name: string; model: ScnModel; scn: Scenario; period: [number, number]; times: number[]; data: Traj }

function scenarioTitle(model: ScnModel, scn: Scenario) {
  if (!scn) return `${short(model)} · Baseline`
  if (scn.kind === 'lockdown') {
    return `${short(model)} · Extra lockdown from ${fmtDate(dayToTime(scn.start))}, ${scn.duration} days, Rₜ −${scn.reduction}%`
  }
  return `${short(model)} · School reopening delayed to ${fmtDate(dayToTime(SCHOOL_CP + scn.delay))} (${scn.delay} days later)`
}

function scenarioWindow(scn: Scenario): Window | null {
  if (!scn) return null
  if (scn.kind === 'lockdown') return { a: dayToTime(scn.start), b: dayToTime(scn.start + scn.duration), label: 'Extra Rₜ reduction' }
  return { a: dayToTime(SCHOOL_CP), b: dayToTime(SCHOOL_CP + scn.delay), label: 'School reopening delayed' }
}

function runScenario(inp: ModelInputs, scn: Scenario) {
  const sched = !scn ? fittedSchedule(inp.betas)
    : scn.kind === 'lockdown' ? lockdownSchedule(inp.betas, scn.start, scn.duration, scn.reduction / 100)
    : schoolReopeningSchedule(inp.betas, scn.delay)
  return simulate(inp, sched)
}

// Saved simulations stay in this browser (localStorage), when it allows it.
const STORE = 'euvabeco.savedScenarios.v1'
function readSaved(): Saved[] {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '[]') } catch { return [] }
}
function writeSaved(s: Saved[]) {
  try { localStorage.setItem(STORE, JSON.stringify(s)) } catch { /* storage unavailable */ }
}

let bandsPromise: Promise<Bands> | null = null
function getBands(): Promise<Bands> {
  if (!bandsPromise) {
    bandsPromise = loadAgeDraws().then(d => new Promise<Bands>((res, rej) => {
      const w = new Worker(new URL('../lib/bandsWorker.ts', import.meta.url), { type: 'module' })
      w.onmessage = e => { res(e.data); w.terminate() }
      w.onerror = e => { rej(e); w.terminate(); bandsPromise = null }
      w.postMessage(d)
    }))
  }
  return bandsPromise
}

export default function ScenarioMode() {
  const inputs = useData<Record<string, ModelInputs>>('sim_inputs')
  const [model, setModel] = useState<ScnModel>('sim_m1')
  const [type, setType] = useState<ScnType>('lockdown')
  const [zone, setZone] = useState(FREE_ZONES[1].label)
  const [startByZone, setStartByZone] = useState<Record<string, number>>({})
  const [durByZone, setDurByZone] = useState<Record<string, number>>({})
  const [reduction, setReduction] = useState(40)
  const [delay, setDelay] = useState(21)
  const [period, setPeriod] = useState<[number, number]>([0, N_DAYS - 1])
  const [config, setConfig] = useState<Config | null>(null)
  const [tab, setTab] = useState<'results' | 'compare'>('results')
  const [saved, setSaved] = useState<Saved[]>(readSaved)
  useEffect(() => writeSaved(saved), [saved])

  const z = FREE_ZONES.find(f => f.label === zone)!
  const startDay = Math.min(Math.max(startByZone[zone] ?? z.lo, z.lo), z.hi - 1)
  const maxDur = z.hi - startDay
  const duration = Math.min(durByZone[zone] ?? Math.min(14, maxDur), maxDur)
  const scn: Scenario = type === 'baseline' ? null
    : type === 'lockdown' ? { kind: 'lockdown', start: startDay, duration: Math.max(duration, 1), reduction }
    : { kind: 'school', delay }
  const current: Config = { model, scn, period }
  const changed = config != null && JSON.stringify(config) !== JSON.stringify(current)

  if (!inputs) return <Loading />

  const run = () => { setConfig(current); setTab('results') }

  return (
    <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card accent icon={FlaskConical} title="Set up a scenario" subtitle="Simulated values only, on top of each model's fitted transmission.">
          <div className="space-y-5">
            <Field label="Model">
              <RadioCards name="scn-model" value={model} onChange={setModel}
                options={SCN_MODELS.map(m => ({ value: m.value, label: MODEL_OPTIONS[m.choice].name, caption: MODEL_OPTIONS[m.choice].caption }))} />
            </Field>
            <Field label="Scenario">
              <Segmented full size="sm" value={type} onChange={setType} options={[
                { value: 'baseline', label: 'Baseline' }, { value: 'lockdown', label: 'Extra lockdown' }, { value: 'school', label: 'Later reopening' },
              ]} />
            </Field>

            {type === 'lockdown' && <div className="space-y-4 rounded-lg bg-surface-2 p-3.5">
              <p className="text-[12.5px] leading-snug text-muted">
                The two real lockdowns stay as fitted: spring 2020 (<strong className="text-ink-2">{fmtDate(dayToTime(FITTED_CP[0]))} – {fmtDate(dayToTime(FITTED_CP[1]))}</strong>)
                and the Nov 2020 tightening (from <strong className="text-ink-2">{fmtDate(dayToTime(FITTED_CP[3]))}</strong>). Place the extra lockdown anywhere else, for any duration.
              </p>
              <Field label="When">
                <Segmented full size="sm" value={zone} onChange={setZone}
                  options={FREE_ZONES.map(f => ({ value: f.label, label: f.label.replace('Before the spring lockdown', 'Before spring').replace('Between the two lockdowns', 'Between lockdowns') }))} />
              </Field>
              <Field label="Extra lockdown start date" hint={`Any date between ${fmtDate(dayToTime(z.lo))} and ${fmtDate(dayToTime(z.hi - 1))}.`}>
                <DateInput value={isoDate(dayToTime(startDay))} min={isoDate(dayToTime(z.lo))} max={isoDate(dayToTime(z.hi - 1))}
                  onChange={v => setStartByZone({ ...startByZone, [zone]: timeToDay(parseIso(v)) })} />
              </Field>
              {maxDur > 1 ? (
                <Field label="Duration of the Rₜ reduction" hint="Capped so the window ends before the next real lockdown. Afterwards it is back to the baseline Rₜ.">
                  <Slider min={1} max={maxDur} value={duration} onChange={v => setDurByZone({ ...durByZone, [zone]: v })} format={v => `${v} day${v === 1 ? '' : 's'}`} />
                </Field>
              ) : <p className="text-[12.5px] text-muted">Only 1 day of room left before the next real lockdown. Pick an earlier start date for a longer window.</p>}
              <Field label="Rₜ reduction" hint="Reduction relative to the baseline Rₜ, inside the window.">
                <Slider min={5} max={90} step={5} value={reduction} onChange={setReduction} format={v => `${v}%`} />
              </Field>
              <p className="text-[12.5px] text-ink-2">Rₜ reduced from <strong>{fmtDate(dayToTime(startDay))}</strong> to <strong>{fmtDate(dayToTime(Math.min(startDay + duration, N_DAYS - 1)))}</strong>.</p>
            </div>}

            {type === 'school' && <div className="space-y-4 rounded-lg bg-surface-2 p-3.5">
              <p className="text-[12.5px] leading-snug text-muted">
                Schools actually reopened on <strong className="text-ink-2">{fmtDate(dayToTime(SCHOOL_CP))}</strong>, when β steps up from the lower summer
                level to the higher post-reopening level. Push that switch later, as long as it doesn't reach the next real changepoint, the Nov 2020
                tightening on <strong className="text-ink-2">{fmtDate(dayToTime(NEXT_CP))}</strong>.
              </p>
              <Field label="Delay school reopening by">
                <Slider min={1} max={MAX_SCHOOL_DELAY} value={delay} onChange={setDelay} format={v => `${v} day${v === 1 ? '' : 's'}`} />
              </Field>
              <p className="text-[12.5px] text-ink-2">Reopening moved from <strong>{fmtDate(dayToTime(SCHOOL_CP))}</strong> to <strong>{fmtDate(dayToTime(SCHOOL_CP + delay))}</strong>.</p>
            </div>}

            {type === 'baseline' && <p className="text-[12.5px] text-muted">The fitted model as it is, with no counterfactual change.</p>}

            <Field label="Period to show">
              <RangeSlider min={0} max={N_DAYS - 1} value={period} onChange={setPeriod} format={d => fmtDate(dayToTime(d))} />
            </Field>
            <Button variant="primary" icon={Play} className="w-full" onClick={run}>Run scenario simulation</Button>
          </div>
        </Card>
      </aside>

      <section className="min-w-0 space-y-5">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'results', label: 'Results', icon: SlidersHorizontal },
          { value: 'compare', label: 'Compare', icon: GitCompareArrows,
            badge: saved.length ? <span className="rounded-full bg-primary-soft px-1.5 text-[11.5px] font-semibold text-primary">{saved.length}</span> : undefined },
        ]} />
        <div className="animate-in" key={tab}>
          {tab === 'results' && (config == null ? (
            <EmptyState icon={ArrowLeft} title="Set up a scenario">
              Choose a model and a scenario: an extra lockdown (start date, duration, Rₜ reduction) or a later school
              reopening (delay). Then press <strong>Run scenario simulation</strong>. Save the results and open
              <strong> Compare</strong> to set them against the baseline.
            </EmptyState>
          ) : (
            <Results config={config} changed={changed} inp={inputs[config.model]} saved={saved}
              onSave={s => setSaved([...saved, s])} />
          ))}
          {tab === 'compare' && <Compare saved={saved} setSaved={setSaved} />}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
function Results({ config, changed, inp, saved, onSave }: {
  config: Config; changed: boolean; inp: ModelInputs; saved: Saved[]; onSave: (s: Saved) => void
}) {
  const mode = useThemeMode()
  const ct = chartTheme(mode)
  const { model, scn, period } = config
  const [view, setView] = useState<'Plots' | 'Epidemic metrics' | 'Overlay'>('Plots')
  const [bands, setBands] = useState<Bands | null>(null)
  const [bandsBusy, setBandsBusy] = useState(false)
  const { pair, picker } = useOverlay()
  const toast = useToast()
  const title = scenarioTitle(model, scn)
  const [name, setName] = useState(title)
  const lastTitle = useRef(title)
  if (lastTitle.current !== title) { lastTitle.current = title; setName(title) }

  const tr = useMemo(() => runScenario(inp, scn), [inp, scn])
  // The band is switched on from the results, for the fitted Model 3b
  // baseline only; every new run starts from the point estimates.
  const bandsAvailable = model === 'age_point' && scn === null
  const [bandsOn, setBandsOn] = useState(false)
  useEffect(() => setBandsOn(false), [config])
  const wantBands = bandsAvailable && bandsOn
  useEffect(() => {
    if (!wantBands) { setBands(null); return }
    setBandsBusy(true)
    getBands().then(b => { setBands(b); setBandsBusy(false) }, () => setBandsBusy(false))
  }, [wantBands])

  const times = Array.from({ length: N_DAYS }, (_, d) => dayToTime(d))
  const start = dayToTime(period[0]), end = dayToTime(period[1])
  const window = scenarioWindow(scn)
  const data: Traj = { cases: Array.from(tr.cases), ward: Array.from(tr.ward), icu: Array.from(tr.icu), deaths: Array.from(tr.deaths), Rt: Array.from(tr.Rt) }
  const metrics = computeMetrics(times, data, times, data.Rt, start, end)
  const b4 = inp.betas[3], b5 = inp.betas[4]

  const save = () => {
    const base = name.trim() || title
    let final = base, k = 2
    while (saved.some(s => s.name === final)) final = `${base} (${k++})`
    const i0 = period[0], i1 = period[1] + 1
    const cut = (a: number[]) => a.slice(i0, i1)
    onSave({ name: final, model, scn, period, times: times.slice(i0, i1),
      data: { cases: cut(data.cases), ward: cut(data.ward), icu: cut(data.icu), deaths: cut(data.deaths), Rt: cut(data.Rt) } })
    toast.show(`Saved as “${final}”. Open Compare to compare it with other saved simulations.`)
  }

  const panel = (s: Series | 'Rt') => {
    const col = seriesColor(s, mode)
    const layers: Layer[] = []
    const tips: TipRow[] = [{ label: scn ? 'Scenario' : 'Simulated', values: data[s], digits: s === 'Rt' ? 3 : 0 }]
    if (s !== 'Rt' && bands) {
      layers.push({ kind: 'band', name: '95% predictive', lo: bands[s].lo, hi: bands[s].hi, color: col, opacity: 0.22 })
      tips.push({ label: '95% band, low', values: bands[s].lo }, { label: '95% band, high', values: bands[s].hi })
    }
    layers.push({ kind: 'line', name: s, values: data[s], color: col })
    return timePanel({ ct, title: s === 'Rt' ? undefined : SERIES_SHORT[s], times, start, end, layers, tips, window,
      rtLine: s === 'Rt', yDigits: s === 'Rt' ? 1 : undefined, yName: s === 'Rt' ? 'Rₜ' : undefined })
  }
  const side = (n: string) => {
    const k = OV_SERIES[n]
    return { name: n, times, values: data[k], color: seriesColor(k, mode), isRt: k === 'Rt' }
  }

  return (
    <div className="space-y-5">
      {changed && (
        <Callout icon={RefreshCw} tone="warn">The selection has changed. Press <strong>Run scenario simulation</strong> to update; the results below are for the last run.</Callout>
      )}
      <div>
        <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-[13px] text-muted">
          Period: {fmtDate(start)} – {fmtDate(end)}. Only simulated values are shown. For reference, the fitted switch on
          06/11/2020 already reduces β by {(100 * (1 - b5 / b4)).toFixed(0)}% in this model (β₄ = {b4.toFixed(4)} → β₅ = {b5.toFixed(4)}).
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary-soft/50 p-3 shadow-card sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-[13px] font-medium">Name for this simulation</span>
          <input value={name} onChange={e => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] hover:border-line-strong" />
        </label>
        <Button icon={BookmarkPlus} onClick={save}>Save simulation</Button>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary-soft/50 px-4 py-3">
        <Toggle checked={bandsOn} onChange={setBandsOn} disabled={!bandsAvailable}
          label={`Show 95% Bayesian band (${N_BAND_DRAWS} posterior draws)`}
          hint={bandsAvailable
            ? 'Integrates 500 posterior draws of Model 3b and adds the fitted observation noise, corrected for residual autocorrelation.'
            : 'Available for the Model 3b baseline (no counterfactual scenario).'} />
      </div>

      <Segmented value={view} onChange={setView} options={[
        { value: 'Plots', label: 'Plots' }, { value: 'Epidemic metrics', label: 'Epidemic metrics' }, { value: 'Overlay', label: 'Overlay' },
      ]} />

      <div className="animate-in space-y-4" key={view}>
        {view === 'Plots' && <>
          <Legend items={[
            ['line', ct.muted, scn ? 'Scenario' : 'Simulated (fitted baseline)'],
            ...(bands ? [['band', ct.muted, `95% predictive band (${N_BAND_DRAWS} posterior draws)`] as ['band', string, string]] : []),
            ...(window ? [['window', ct.window, `Window where it differs (${window.label})`] as ['window', string, string]] : []),
            ['rule', ct.rule, 'Fitted changepoint'],
          ]} />
          {bandsBusy && <p className="text-[13px] text-muted">Integrating {N_BAND_DRAWS} posterior draws…</p>}
          <PanelGrid>{SERIES.map(s => <ChartCard key={s} color={seriesColor(s, mode)}><EChart option={panel(s)} height={250} /></ChartCard>)}</PanelGrid>
          <Card title="Effective reproduction number Rₜ"><EChart option={panel('Rt')} height={260} /></Card>
        </>}
        {view === 'Epidemic metrics' && <MetricsView m={metrics} />}
        {view === 'Overlay' && (
          <Card title="Overlay" subtitle="Compare two simulated series on the same time axis, each with its own y-axis, so that their different scales do not matter.">
            <div className="space-y-4">{picker}<EChart option={overlayChart(ct, start, end, side(pair[0]), side(pair[1]), window)} height={360} /></div>
          </Card>
        )}
      </div>
      {toast.node}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------
function Compare({ saved, setSaved }: { saved: Saved[]; setSaved: (s: Saved[]) => void }) {
  const mode = useThemeMode()
  const ct = chartTheme(mode)
  const names = saved.map(s => s.name)
  const [chosen, setChosen] = useState<string[]>(names)
  const [series, setSeries] = useState<Series | 'Rt'>('cases')
  const [drop, setDrop] = useState<string[]>([])
  const namesKey = names.join('\u0000')
  useEffect(() => setChosen(names), [namesKey]) // newly saved or removed: select all again

  if (!saved.length) {
    return (
      <EmptyState icon={Bookmark} title="No saved simulations yet">
        Run a scenario in <strong>Results</strong>, press <strong>Save simulation</strong>, and repeat for the scenarios you
        want to compare. Saved simulations stay in this browser.
      </EmptyState>
    )
  }
  const items = saved.filter(s => chosen.includes(s.name))
  const label = SERIES_SHORT[series]
  const isRt = series === 'Rt'
  const option = (theme = ct) => compareChart(theme, items.map(s => ({ name: s.name, times: s.times, values: s.data[series] })), label, isRt)

  const metricsOf = (s: Saved) => computeMetrics(s.times, s.data, s.times, s.data.Rt, -Infinity, Infinity)
  const ref = items.length ? metricsOf(items[0]) : null
  const rows = items.map(s => {
    const m = metricsOf(s)
    const peak = isRt ? { value: m.rtMax, time: m.rtDay } : m.peaks[series as Series]
    return {
      name: s.name, period: `${fmtDate(s.times[0])} – ${fmtDate(s.times[s.times.length - 1])}`,
      cases: fmtInt(m.cases), dc: pctChange(m.cases, ref!.cases), deaths: fmtInt(m.deaths), dd: pctChange(m.deaths, ref!.deaths),
      peak: isRt ? fmtNum(peak.value, 2) : fmtInt(peak.value), peakDay: fmtDate(peak.time),
    }
  })
  const pct = (v: unknown) => {
    const n = v as number | null
    if (n == null) return '—'
    const txt = `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
    return <span className={Math.abs(n) < 0.05 ? 'text-muted' : n < 0 ? 'text-[#0f8a5f] dark:text-[#3ccf95]' : 'text-accent'}>{txt}</span>
  }

  const downloadCsv = () => {
    const out: (string | number)[][] = []
    for (const s of items) s.times.forEach((t, i) => out.push([isoDate(t), ...SERIES.map(k => +s.data[k][i].toFixed(4)), +s.data.Rt[i].toFixed(5), s.name]))
    saveText(toCsv(['date', ...SERIES, 'Rt', 'simulation'], out), 'saved_scenarios.csv')
  }
  const downloadPng = async () => saveBlob(await exportPng([option(chartTheme('light'))], { height: 380 + 20 * items.length, title: `${label} — saved simulations` }), `compare_${series}.png`)

  return (
    <div className="space-y-5">
      <Card title="Saved simulations" subtitle="Differences in the table are relative to the first one selected.">
        <div className="space-y-4">
          <CheckList options={names} value={chosen} onChange={v => setChosen(names.filter(n => v.includes(n)))} />
          <Segmented size="sm" value={series} onChange={setSeries}
            options={(['cases', 'ward', 'icu', 'deaths', 'Rt'] as const).map(s => ({ value: s, label: SERIES_SHORT[s] }))} />
        </div>
      </Card>
      {items.length > 0 && <>
        <ChartCard><EChart option={option()} height={380 + 20 * items.length} /></ChartCard>
        <div>
          <h4 className="mb-2 text-[14px] font-semibold">Summary <span className="font-normal text-muted">(differences relative to <strong className="text-ink">{items[0].name}</strong>)</span></h4>
          <DataTable columns={[
            { key: 'name', label: 'Simulation', className: 'font-medium min-w-56' },
            { key: 'period', label: 'Period', className: 'whitespace-nowrap text-ink-2' },
            { key: 'cases', label: 'Total cases', align: 'right' },
            { key: 'dc', label: 'vs first', align: 'right', render: r => pct(r.dc) },
            { key: 'deaths', label: 'Total deaths', align: 'right' },
            { key: 'dd', label: 'vs first', align: 'right', render: r => pct(r.dd) },
            { key: 'peak', label: isRt ? 'Highest Rₜ' : `Peak ${label}`, align: 'right' },
            { key: 'peakDay', label: 'Peak day', align: 'right' },
          ]} rows={rows} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={downloadCsv}>Trajectories (CSV)</Button>
          <Button icon={ImageIcon} onClick={downloadPng}>Comparison plot (PNG)</Button>
        </div>
      </>}
      <details className="group rounded-xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13.5px] font-medium text-ink-2">
          <Trash2 className="size-4" />Manage saved simulations
        </summary>
        <div className="space-y-3 border-t border-line px-4 py-3.5">
          <CheckList options={names} value={drop} onChange={setDrop} />
          <Button size="sm" icon={Trash2} disabled={!drop.length}
            onClick={() => { setSaved(saved.filter(s => !drop.includes(s.name))); setDrop([]) }}>Remove selected</Button>
        </div>
      </details>
    </div>
  )
}
