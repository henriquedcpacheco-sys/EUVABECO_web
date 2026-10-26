import { useMemo, useState, type ReactNode } from 'react'
import katex from 'katex'
import {
  ArrowLeft, ChartLine, SlidersHorizontal, ChevronDown, Download, FunctionSquare, Info, Lock, Play, SearchCheck, Users,
} from 'lucide-react'
import {
  Button, Callout, Card, DataTable, EmptyState, Field, Legend, Md, RadioCards, RangeSlider, Segmented, Tabs, Toggle,
} from '../components/ui'
import { EChart, chartTheme, exportPng, useThemeMode, type Option } from '../components/EChart'
import {
  AGE_PARAM_NOTES, BAYES_KEY, DAY_MS, ESTIMATED_PARAMS, FIXED_PARAMS, MODEL_LABELS,
  MODEL_OPTIONS, NPI_EVENTS, POINT_KEY, SERIES, SERIES_DEEP, SERIES_LABELS, dayToTime, paramMeaning,
  paramSymbol, type ModelChoice, type Series,
} from '../lib/model'
import { useData, type BayesFit, type Comparison, type Observed, type PointFit } from '../lib/data'
import { histogramChart, overlayChart, residualChart, timePanel, type Layer, type TipRow } from '../lib/charts'
import { fmtDate, fmtNum, fmtSig } from '../lib/format'
import { comparisonCsv, saveZip, toCsv } from '../lib/download'
import {
  ChartCard, MetricsView, OV_SERIES, PanelGrid, computeMetrics, metricsCsvRows, seriesColor, useOverlay,
} from './shared'

type Tab = 'data' | 'params' | 'fit'
type View = 'Fit' | 'Fit quality' | 'Parameters' | 'Rₜ' | 'Epidemic metrics' | 'Overlay'

const J_FORMULA = String.raw`J = \sum_{s \,\in\, \{\text{cases, ward, ICU, deaths}\}} \sum_{t} \Big(\log(y_s(t)+1) - \log(\hat{y}_s(t)+1)\Big)^2`

function Tex({ tex }: { tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: true, throwOnError: false }), [tex])
  return <div className="overflow-x-auto rounded-lg bg-surface-2 px-4 py-1" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function FitMode({ flexiblePeriod }: { flexiblePeriod: boolean }) {
  const observed = useData<Observed>('observed')
  const comparison = useData<Comparison>('comparison')
  const [period, setPeriod] = useState<[number, number]>([0, 305])
  const [model, setModel] = useState<ModelChoice | null>(null)
  const [ranKey, setRanKey] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('data')
  const [bands, setBands] = useState(false)
  const [view, setView] = useState<View>('Fit')

  // The fit always runs with the least-squares point estimates; the Bayesian
  // bands are switched on afterwards, from the results.
  const modelKey = model ? POINT_KEY[model] : null
  const simulated = modelKey != null && ranKey === modelKey

  if (!observed || !comparison) return <Loading />

  const obsTimes = Array.from({ length: observed.n }, (_, i) => Date.parse(observed.start) + i * DAY_MS)
  const [p0, p1] = flexiblePeriod ? period : [0, observed.n - 1]
  const start = obsTimes[p0], end = obsTimes[p1]

  const run = () => { setRanKey(modelKey); setBands(false); setTab('fit') }

  return (
    <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card accent icon={SlidersHorizontal} title="Set up the fit" subtitle={flexiblePeriod ? 'Choose the period and a model.' : 'Whole of 2020. Choose a model.'}>
          <div className="space-y-5">
            {flexiblePeriod && (
              <Field label="Period to display" hint="All models were fitted on the whole of 2020. This selects the window shown in every plot.">
                <RangeSlider min={0} max={observed.n - 1} value={period} onChange={setPeriod} format={i => fmtDate(obsTimes[i])} />
              </Field>
            )}
            <Field label="Model" hint="The models differ in how the hospitalisation probability ψ is constructed.">
              <RadioCards name="model" value={model} onChange={setModel}
                options={(Object.keys(MODEL_OPTIONS) as ModelChoice[]).map(k => ({ value: k, label: MODEL_OPTIONS[k].name, caption: MODEL_OPTIONS[k].caption }))} />
            </Field>
            <Button variant="primary" icon={Play} className="w-full" disabled={!modelKey} onClick={run}
              title={modelKey ? undefined : 'Pick a model first.'}>
              Run model fitting
            </Button>
          </div>
        </Card>
      </aside>

      <section className="min-w-0 space-y-5">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'data', label: 'Data and fixed dates', icon: ChartLine },
          { value: 'params', label: 'Parameters', icon: FunctionSquare },
          { value: 'fit', label: 'Fitted model', icon: SearchCheck,
            badge: simulated ? <span className="size-1.5 rounded-full bg-primary" /> : undefined },
        ]} />
        <div className="animate-in" key={tab}>
          {tab === 'data' && <DataTab observed={observed} times={obsTimes} start={start} end={end} />}
          {tab === 'params' && <ParamsTab model={model} />}
          {tab === 'fit' && (
            <FittedTab model={model} modelKey={modelKey} simulated={simulated} observed={observed}
              obsTimes={obsTimes} start={start} end={end} comparison={comparison}
              bands={bands} setBands={setBands} view={view} setView={setView} />
          )}
        </div>
      </section>
    </div>
  )
}

export function Loading() {
  return (
    <div className="grid place-items-center py-24 text-muted">
      <div className="size-7 animate-spin rounded-full border-2 border-line-strong border-t-primary" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Data and fixed dates
// ---------------------------------------------------------------------------
function DataTab({ observed, times, start, end }: { observed: Observed; times: number[]; start: number; end: number }) {
  const mode = useThemeMode()
  const ct = chartTheme(mode)
  return (
    <div className="space-y-5">
      <p className="max-w-4xl text-[14.5px] leading-relaxed text-ink-2">
        Four observed daily series for Portugal in 2020. The dashed vertical lines are the <strong className="text-ink">fixed
        NPI dates</strong> (non-pharmaceutical interventions): the transmission rate β is constant between them, and can
        change at each one. For the age-stratified model and the testing-volume coupling, new data is introduced: the
        daily age composition of confirmed cases, and the daily testing volume.
      </p>
      <Legend items={[
        ...SERIES.map(s => ['dot', seriesColor(s, mode), SERIES_LABELS[s].replace('Daily confirmed cases', 'Cases')] as ['dot', string, string]),
        ['rule', ct.rule, 'Fixed NPI date (hover for the event)'],
      ]} />
      <PanelGrid>
        {SERIES.map(s => (
          <ChartCard key={s} color={seriesColor(s, mode)}>
            <EChart height={250} option={timePanel({
              ct, title: SERIES_LABELS[s], times, start, end,
              layers: [{ kind: 'dots', name: 'Observed', values: observed[s], color: seriesColor(s, mode) }],
              tips: [{ label: 'Observed', values: observed[s] }],
            })} />
          </ChartCard>
        ))}
      </PanelGrid>
      <Card title="Interventions and the changepoints used"
        subtitle="Each changepoint was estimated from the case data inside the 21 days that follow its policy date, giving 5 periods with their own β.">
        <DataTable columns={[
          { key: 'event', label: 'NPI event' },
          { key: 'policy', label: 'Policy date', align: 'right' },
          { key: 'cp', label: 'Changepoint used', align: 'right' },
          { key: 'days', label: 'Days after policy', align: 'right' },
        ]} rows={NPI_EVENTS.map(e => ({ event: e[0], policy: fmtDate(Date.parse(e[1])), cp: fmtDate(Date.parse(e[2])), days: e[3] }))} />
      </Card>
      <p className="text-[13px] leading-relaxed text-muted">
        <strong className="text-ink-2">Data sources:</strong> daily confirmed cases, deaths, ward/ICU occupancy and the age
        breakdown of confirmed cases come from DSSG Portugal's{' '}
        <a className="text-primary hover:underline" href="https://github.com/dssg-pt/covid19pt-data">covid19pt-data</a> project.
        Daily testing volume comes from <a className="text-primary hover:underline" href="https://github.com/owid/covid-19-data">Our World in Data</a>'s testing dataset.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Parameters
// ---------------------------------------------------------------------------
function ParamsTab({ model }: { model: ModelChoice | null }) {
  const cols = [{ key: 'p', label: 'Parameter', className: 'whitespace-nowrap font-medium' }, { key: 'm', label: 'Meaning' }]
  return (
    <div className="space-y-5">
      <p className="max-w-4xl text-[14.5px] leading-relaxed text-ink-2">
        The model has fixed parameters taken from the literature, and parameters estimated from the data. Each model
        variant estimates a different set; the exact list for the model you run is in its <strong className="text-ink">Parameters</strong> view.
      </p>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={<span className="inline-flex items-center gap-2"><Lock className="size-4 text-muted" />Fixed</span>}>
          <DataTable dense columns={cols} rows={FIXED_PARAMS.map(([p, m]) => ({ p, m }))} />
        </Card>
        <Card title={<span className="inline-flex items-center gap-2"><SearchCheck className="size-4 text-muted" />Estimated from the data</span>}>
          <DataTable dense columns={cols} rows={ESTIMATED_PARAMS.map(([p, m]) => ({ p, m }))} />
        </Card>
      </div>
      {(model === 'age_nocorr' || model === 'age_3b') && (
        <Callout icon={Info}><Md text={AGE_PARAM_NOTES[model === 'age_nocorr' ? '3a' : '3b']} /></Callout>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Fitted model
// ---------------------------------------------------------------------------
function AgeNote({ model, open }: { model: ModelChoice; open: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 font-semibold">
        <Users className="size-4 text-primary" />Age structure: new data and model structure
        <ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="prose-app grid gap-5 border-t border-line px-5 py-4 text-[14px] text-ink-2 md:grid-cols-2">
        <div>
          <h4>New data</h4>
          <ul><li>Confirmed cases by age band and sex (DSSG Portugal), summed into four groups: 0-49, 50-59, 60-69 and 70+.</li>
            {model === 'age_3b' && <li><strong>Model 3b only:</strong> it also uses the daily testing volume (Our World in Data), whose 7-day rolling sum drives the coupling Ch(t) that scales ψ(t) down as testing grows.</li>}
          </ul>
        </div>
        <div>
          <h4>New model structure</h4>
          <ul>
            <li>Each age group has its own hospitalisation probability, doubling from one group to the next (ψ_base, 2ψ_base, 4ψ_base, 8ψ_base), roughly matching the age-specific hospitalisation ratios in Caetano et al.</li>
            <li>Each day, ψ(t) is the average of the four group values weighted by that day's age composition, so ψ rises when older people make up more of the cases.</li>
          </ul>
        </div>
        <p className="md:col-span-2"><Md text={AGE_PARAM_NOTES[model === 'age_nocorr' ? '3a' : '3b']} /></p>
      </div>
    </details>
  )
}

function ModelsAtAGlance({ comparison }: { comparison: Comparison }) {
  const names = Object.keys(comparison.models)
  const maxJ = Math.max(...names.map(n => comparison.models[n].J.total))
  return (
    <Card title="Models at a glance" subtitle="J: sum of squared log-residuals between data and model. The Bayesian column uses the posterior-mean parameters.">
      <DataTable columns={[
        { key: 'name', label: 'Model', className: 'font-medium' },
        { key: 'n', label: 'Estimated parameters', align: 'right' },
        ...(['cases', 'ward', 'icu', 'deaths'] as const).map(k => ({ key: k, label: `J — ${k === 'icu' ? 'ICU' : k}`, align: 'right' as const })),
        { key: 'total', label: 'J — total', render: (r: Record<string, unknown>) => (
          <div className="flex min-w-36 items-center gap-2.5">
            <div className="h-1.5 flex-1 rounded-full bg-surface-3"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(100 * (r.totalRaw as number)) / maxJ}%` }} /></div>
            <span className="w-12 text-right tabular-nums font-semibold">{r.total as string}</span>
          </div>) },
      ]} rows={names.map(n => {
        const m = comparison.models[n]
        return { name: n, n: m.nEst, cases: fmtNum(m.J.cases), ward: fmtNum(m.J.ward), icu: fmtNum(m.J.icu),
          deaths: fmtNum(m.J.deaths), total: fmtNum(m.J.total), totalRaw: m.J.total }
      })} />
    </Card>
  )
}

interface FittedProps {
  model: ModelChoice | null; modelKey: string | null; simulated: boolean; observed: Observed
  obsTimes: number[]; start: number; end: number; comparison: Comparison
  bands: boolean; setBands: (v: boolean) => void; view: View; setView: (v: View) => void
}

function FittedTab(p: FittedProps) {
  const age = p.model === 'age_nocorr' || p.model === 'age_3b'
  return (
    <div className="space-y-5">
      {age && <AgeNote model={p.model!} open={!p.simulated} />}
      {!p.modelKey ? (
        <>
          <EmptyState icon={ArrowLeft} title="Pick a model">
            Choose one of the four models, then press <strong>Run model fitting</strong>. The table
            below compares the fit error J of every model.
          </EmptyState>
          <ModelsAtAGlance comparison={p.comparison} />
        </>
      ) : !p.simulated ? (
        <EmptyState icon={Play} title="Ready to run">Press <strong>Run model fitting</strong> to see the fitted result.</EmptyState>
      ) : p.bands ? (
        <BayesResult {...p} modelKey={BAYES_KEY[p.model!]} />
      ) : (
        <PointResult {...p} modelKey={p.modelKey} />
      )}
    </div>
  )
}

function PointResult(p: FittedProps & { modelKey: string }) {
  const fit = useData<PointFit>(p.modelKey)
  if (!fit) return <Loading />
  return <Result {...p} sim={fit.sim} rt={fit.rt} point={fit} />
}

function BayesResult(p: FittedProps & { modelKey: string }) {
  const fit = useData<BayesFit>(p.modelKey)
  if (!fit) return <Loading />
  return <Result {...p} sim={fit.bands.point_est} rt={fit.rt} bayes={fit} />
}

/** Week (Monday) start of a UTC timestamp. */
const weekStart = (t: number) => { const d = new Date(t); return t - ((d.getUTCDay() + 6) % 7) * DAY_MS }

function weeklyResiduals(obs: Observed, sim: Record<Series, number[]>, times: number[], start: number, end: number) {
  const weeks: number[] = []
  const vals: Record<Series, number[]> = { cases: [], ward: [], icu: [], deaths: [] }
  times.forEach((t, i) => {
    if (t < start || t > end) return
    const w = weekStart(t)
    if (weeks[weeks.length - 1] !== w) { weeks.push(w); SERIES.forEach(s => vals[s].push(0)) }
    SERIES.forEach(s => {
      const r = Math.log(Math.max(sim[s][i], 0) + 1) - Math.log(obs[s][i] + 1)
      vals[s][vals[s].length - 1] += r * r
    })
  })
  return { weeks, vals }
}

const VIEWS: View[] = ['Fit', 'Fit quality', 'Parameters', 'Rₜ', 'Epidemic metrics', 'Overlay']

function Result(p: FittedProps & { modelKey: string; sim: Record<Series, number[]>; rt: number[]; point?: PointFit; bayes?: BayesFit }) {
  const mode = useThemeMode()
  const ct = chartTheme(mode)
  const { view, setView } = p
  const [busy, setBusy] = useState(false)
  const { pair, picker } = useOverlay()
  const { observed: obs, obsTimes: times, start, end, bayes, sim } = p
  const rtTimes = p.rt.map((_, i) => dayToTime(i))
  const label = MODEL_LABELS[p.modelKey]
  const pointKeyLabel = bayes ? MODEL_OPTIONS[p.model!].short : ''

  // ---- chart options (built for the current theme; rebuilt in light for the PNGs)
  const build = (ct: ReturnType<typeof chartTheme>, light: boolean) => {
    const col = (s: Series | 'Rt') => seriesColor(s, light ? 'light' : mode)
    const fitPanels: Option[] = SERIES.map(s => {
      const layers: Layer[] = [], tips: TipRow[] = [{ label: 'Observed', values: obs[s] }]
      if (bayes) {
        layers.push({ kind: 'band', name: '95% predictive', lo: bayes.bands.obs_lo[s], hi: bayes.bands.obs_hi[s], color: col(s), opacity: 0.16 })
        layers.push({ kind: 'band', name: '95% credible', lo: bayes.bands.pred_lo[s], hi: bayes.bands.pred_hi[s], color: col(s), opacity: 0.38 })
        layers.push({ kind: 'dots', name: 'Observed', values: obs[s], color: ct.obs })
        layers.push({ kind: 'line', name: 'Posterior mean', values: sim[s], color: light || mode === 'light' ? SERIES_DEEP[s] : col(s), width: 2 })
        tips.push({ label: 'Model (posterior mean)', values: sim[s], digits: 1 },
          { label: '95% credible, low', values: bayes.bands.pred_lo[s], digits: 1 },
          { label: '95% credible, high', values: bayes.bands.pred_hi[s], digits: 1 },
          { label: '95% predictive, low', values: bayes.bands.obs_lo[s], digits: 1 },
          { label: '95% predictive, high', values: bayes.bands.obs_hi[s], digits: 1 })
      } else {
        layers.push({ kind: 'dots', name: 'Observed', values: obs[s], color: ct.obs })
        layers.push({ kind: 'line', name: 'Fitted model', values: sim[s], color: col(s) })
        tips.push({ label: 'Fitted model', values: sim[s], digits: 1 })
      }
      return timePanel({ ct, title: SERIES_LABELS[s], times, start, end, layers, tips })
    })
    const rtOpt = timePanel({ ct, times: rtTimes, start, end, rtLine: true, yDigits: 1, yName: 'Rₜ',
      layers: [{ kind: 'line', name: 'Rₜ', values: p.rt, color: col('Rt'), width: 2.4 }],
      tips: [{ label: 'Rₜ = β(t)(1/γ_C + 1/γ_I) · S(t)/N', values: p.rt, digits: 3 }] })
    const wr = weeklyResiduals(obs, sim, times, start, end)
    const resid = residualChart(ct, wr.weeks, SERIES.map(s => ({ name: SERIES_LABELS[s], color: col(s), values: wr.vals[s] })), start, end)
    const side = (name: string) => {
      const k = OV_SERIES[name]
      return k === 'Rt'
        ? { name, times: rtTimes, values: p.rt, color: col('Rt'), isRt: true }
        : { name, times, values: sim[k], color: col(k), isRt: false }
    }
    const overlay = overlayChart(ct, start, end, side(pair[0]), side(pair[1]))
    const hists = bayes ? bayes.params.map(bp => {
      const h = bayes.hist[bp.name]
      return histogramChart(ct, paramSymbol(bp.name), h.edges, h.counts, bp.post_mean, bp.point_est, bp.ci_low, bp.ci_high)
    }) : []
    return { fitPanels, rtOpt, resid, overlay, hists, wr }
  }
  const charts = build(ct, false)
  const metrics = computeMetrics(times, sim, rtTimes, p.rt, start, end)

  // ---- tables
  const jRows = (['cases', 'ward', 'icu', 'deaths', 'total'] as const).map(k => {
    const lbl = { cases: 'Cases', ward: 'Ward', icu: 'ICU', deaths: 'Deaths', total: 'Total' }[k]
    return bayes
      ? { Series: lbl, a: bayes.fit.J_post_mean_params[k], b: bayes.fit.J_draws_mean[k], lo: bayes.fit.J_draws_lo[k], hi: bayes.fit.J_draws_hi[k] }
      : { Series: lbl, a: p.point!.J[k] }
  })
  const otherModels: [string, string][] = [
    ['Model 1 — constant', 'Model 1'], ['Model 2 — piecewise ψ', 'Model 2'],
    ['Model 3a — age-stratified, without coupling', 'Model 3a'],
    ['Model 3b — age-stratified, with coupling (least squares)', 'Model 3b (least squares)'],
  ]
  const compRows = bayes ? [
    ...otherModels.map(([lbl, col]) => ({ Model: lbl, J: p.comparison.models[col].J.total, own: false })),
    { Model: `${pointKeyLabel} — Bayesian, at posterior-mean parameters`, J: bayes.fit.J_post_mean_params.total, own: true },
    { Model: `${pointKeyLabel} — Bayesian, posterior mean of J`, J: bayes.fit.J_draws_mean.total, own: true },
  ] : []
  const paramRows: Record<string, string>[] = bayes
    ? bayes.params.map(bp => ({ name: paramSymbol(bp.name), ls: fmtSig(bp.point_est), mean: fmtSig(bp.post_mean),
        ci: `[${fmtSig(bp.ci_low)}, ${fmtSig(bp.ci_high)}]`, meaning: paramMeaning(bp.name) }))
    : p.point!.params.map(pp => ({ name: paramSymbol(pp.name), value: fmtSig(pp.value), meaning: paramMeaning(pp.name) }))

  // ---- ZIP download
  const download = async () => {
    setBusy(true)
    try {
      const L = build(chartTheme('light'), true)
      const files: Record<string, string | Blob> = {
        'all_models_comparison.csv': comparisonCsv(p.comparison),
        'metrics.csv': toCsv(['Metric', 'Simulated'], metricsCsvRows(metrics)),
        'objective_function_J.csv': bayes
          ? toCsv(['Series', 'J at posterior-mean parameters', 'Posterior mean of J', '95% interval of J'],
              jRows.map(r => [r.Series, +r.a.toFixed(1), +(r.b ?? 0).toFixed(1), `[${fmtNum(r.lo)}, ${fmtNum(r.hi)}]`]))
          : toCsv(['Series', 'J'], jRows.map(r => [r.Series, +r.a.toFixed(1)])),
        'weekly_residual_breakdown.csv': toCsv(['week', ...SERIES],
          L.wr.weeks.map((w, i) => [fmtDate(w), ...SERIES.map(s => +L.wr.vals[s][i].toFixed(4))])),
        'estimated_parameters.csv': bayes
          ? toCsv(['Parameter', 'Least-squares estimate (start of the centred chain)', 'Posterior mean', '95% CI', 'Meaning'],
              paramRows.map(r => [r.name, r.ls, r.mean, r.ci, r.meaning] as string[]))
          : toCsv(['Parameter', 'Estimate', 'Meaning'], paramRows.map(r => [r.name, r.value, r.meaning] as string[])),
        'fitted_model.png': await exportPng(L.fitPanels, { cols: 2, width: 520, height: 280, title: label }),
        'weekly_residual_breakdown.png': await exportPng([L.resid], { title: 'Weekly squared log-residuals', height: 320 }),
        'effective_reproduction_number.png': await exportPng([L.rtOpt], { title: 'Effective reproduction number Rₜ' }),
        'overlay.png': await exportPng([L.overlay], { title: `${pair[0]} (left) vs ${pair[1]} (right) — simulated`, height: 340 }),
      }
      if (bayes) {
        files['model_comparison_J.csv'] = toCsv(['Model', 'J (total)'], compRows.map(r => [r.Model, +r.J.toFixed(1)]))
        files['posterior_histograms.png'] = await exportPng(L.hists, { cols: 4, width: 260, height: 180, title: 'Posterior distributions of the parameters' })
      }
      await saveZip(`${p.modelKey}_results.zip`, files)
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold tracking-tight">{label}</h2>
          <p className="text-[13px] text-muted">{fmtDate(start)} – {fmtDate(end)}</p>
        </div>
        <Button variant="primary" icon={Download} onClick={download} disabled={busy}
          title="This model's tables and figures, and the comparison with all models.">
          {busy ? 'Preparing…' : 'Download results (ZIP)'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-primary/30 bg-primary-soft/50 px-4 py-3">
        <Toggle checked={p.bands} onChange={p.setBands} label="Show 95% Bayesian bands (MCMC)"
          hint="Switches from the least-squares point estimates to the Bayesian posterior: credible and predictive bands, the model at the posterior-mean parameters, and the posterior of every parameter." />
      </div>
      <Segmented value={view} onChange={setView} options={VIEWS.map(v => ({ value: v, label: v }))} />

      <div className="animate-in space-y-5" key={view}>
        {view === 'Fit' && <>
          <Legend items={bayes ? [
            ['dot', ct.obs, 'Observed'], ['line', ct.muted, 'Model at posterior-mean parameters'],
            ['band', ct.muted, '95% credible interval'], ['band-light', ct.muted, '95% posterior predictive'], ['rule', ct.rule, 'NPI date'],
          ] : [['dot', ct.obs, 'Observed'], ['line', ct.muted, 'Fitted model'], ['rule', ct.rule, 'NPI date']]} />
          <PanelGrid>{charts.fitPanels.map((o, i) => <ChartCard key={i} color={seriesColor(SERIES[i], mode)}><EChart option={o} height={260} /></ChartCard>)}</PanelGrid>
          <p className="text-[12.5px] text-muted">Hover a panel to read the values of each day; hover a dashed line for its intervention.</p>
          {bayes && <BandsExplainer />}
        </>}

        {view === 'Fit quality' && <>
          <Card title={bayes ? 'Fit quality of the posterior' : 'Objective function'}>
            <div className="space-y-3 text-[14px] leading-relaxed text-ink-2">
              <p>{bayes
                ? <>The residuals are the same log-residuals as in the other models, now taken between the data and the <strong className="text-ink">solid line</strong> (the model run with the posterior mean of each parameter):</>
                : 'Parameters are estimated by minimising the sum of squared log-residuals between each observed series and its simulated counterpart, summed over the four series:'}</p>
              <Tex tex={J_FORMULA} />
              {bayes && <p>Since every parameter set in the posterior gives its own curve, J is also computed for each of the 500 parameter sets used for the bands, giving a posterior mean and a 95% interval for J.</p>}
            </div>
            <div className={`mt-4 grid gap-5 ${bayes ? '' : 'max-w-md'}`}>
              <div>
                {bayes && <h4 className="mb-2 text-[13.5px] font-semibold">J per series</h4>}
                <DataTable dense highlight={r => r.Series === 'Total'} columns={bayes ? [
                  { key: 'Series', label: 'Series', className: 'font-medium' },
                  { key: 'a', label: 'J at posterior-mean parameters', align: 'right', render: r => fmtNum(r.a as number) },
                  { key: 'b', label: 'Posterior mean of J', align: 'right', render: r => fmtNum(r.b as number) },
                  { key: 'ci', label: '95% interval of J', align: 'right', render: r => `[${fmtNum(r.lo as number)}, ${fmtNum(r.hi as number)}]` },
                ] : [
                  { key: 'Series', label: 'Series', className: 'font-medium' },
                  { key: 'a', label: 'J', align: 'right', render: r => fmtNum(r.a as number) },
                ]} rows={jRows} />
              </div>
              {bayes && (
                <div>
                  <h4 className="mb-2 text-[13.5px] font-semibold">Comparison with the other models <span className="font-normal text-muted">(simultaneous fitting)</span></h4>
                  <DataTable dense highlight={r => r.own as boolean} columns={[
                    { key: 'Model', label: 'Model' },
                    { key: 'J', label: 'J (total)', align: 'right', render: r => fmtNum(r.J as number) },
                  ]} rows={compRows} />
                </div>
              )}
            </div>
            {bayes && <p className="mt-4 text-[12.5px] leading-relaxed text-muted">The least-squares fit is, by construction, the parameter set with the lowest J, so the posterior-mean curve has a slightly higher J, and the posterior mean of J, which averages over all plausible parameter sets, is higher still.</p>}
          </Card>
          <Card title="Weekly residual breakdown" subtitle={`Weekly sum of squared log-residuals, stacked by series${bayes ? ', between the data and the solid line (model at the posterior-mean parameters)' : ''}.`}>
            <EChart option={charts.resid} height={320} />
          </Card>
        </>}

        {view === 'Parameters' && <>
          <DataTable columns={bayes ? [
            { key: 'name', label: 'Parameter', className: 'font-medium whitespace-nowrap' },
            { key: 'ls', label: 'Least-squares estimate (start of the centred chain)', align: 'right' },
            { key: 'mean', label: 'Posterior mean', align: 'right' },
            { key: 'ci', label: '95% CI', align: 'right', className: 'whitespace-nowrap' },
            { key: 'meaning', label: 'Meaning', className: 'text-ink-2 min-w-64' },
          ] : [
            { key: 'name', label: 'Parameter', className: 'font-medium whitespace-nowrap' },
            { key: 'value', label: 'Estimate', align: 'right' },
            { key: 'meaning', label: 'Meaning', className: 'text-ink-2' },
          ]} rows={paramRows} />
          {bayes && <>
            <p className="text-[12.5px] text-muted">Least-squares estimate: the {pointKeyLabel} least-squares fit, used as the starting point of the centred chain (not estimated by the MCMC). Posterior mean and 95% CI: from the pooled MCMC draws.</p>
            <h3 className="pt-2 text-[15px] font-semibold">Posterior distributions of the parameters</h3>
            <Legend items={[
              ['band-light', ct.obs, `Histogram of ${bayes.nDraws} posterior draws, evenly spaced over the pooled chains`],
              ['line', ct.window, 'Posterior mean'], ['dash', ct.text, 'Least-squares estimate'], ['window', ct.window, '95% CI'],
            ]} />
            <PanelGrid cols={4}>{charts.hists.map((o, i) => <ChartCard key={i}><EChart option={o} height={170} /></ChartCard>)}</PanelGrid>
          </>}
        </>}

        {view === 'Rₜ' && (
          <Card title="Effective reproduction number" subtitle="Rₜ = β(t)(1/γ_C + 1/γ_I) · S(t)/N.  Rₜ > 1: the epidemic grows. Rₜ < 1: the epidemic shrinks.">
            <EChart option={charts.rtOpt} height={300} />
          </Card>
        )}

        {view === 'Epidemic metrics' && (
          <MetricsView m={metrics} intro={<>Summary of the simulated trajectories over the period shown
            (<strong className="text-ink">{fmtDate(start)} – {fmtDate(end)}</strong>){bayes ? ', using the model at the posterior-mean parameters (solid line).' : '.'}</>} />
        )}

        {view === 'Overlay' && (
          <Card title="Overlay" subtitle="Compare two simulated series on the same time axis, each with its own y-axis, so that their different scales do not matter.">
            <div className="space-y-4">
              {picker}
              <EChart option={charts.overlay} height={360} />
              {bayes && <p className="text-[12.5px] text-muted">Simulated series: the model at the posterior-mean parameters (solid line in the Fit view).</p>}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Expander({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 text-[14px] font-semibold">
        <Info className="size-4 text-primary" />{title}
        <ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="prose-app border-t border-line px-5 py-4 text-[14px] text-ink-2">{children}</div>
    </details>
  )
}

function BandsExplainer() {
  const t = (s: string) => <span dangerouslySetInnerHTML={{ __html: katex.renderToString(s, { throwOnError: false }) }} />
  return (
    <Expander title="How the posterior was sampled and the two bands obtained">
      <p>A short pilot chain first tunes the sampler; three longer chains (one started at the least-squares estimate, two started well away from it) are then run and pooled once they agree. The fitting is done on the effective sample size of the time series: consecutive days tend to share the same deviation from the model, so the data carry fewer independent observations than the raw number of days.</p>
      <p>500 parameter sets were taken from the chain, spread evenly over the pooled chains, and are used to build both bands.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h4>95% credible interval (darker band): uncertainty in the model curve</h4>
          <ul>
            <li>Each of the 500 parameter sets is run through the ODE model, giving 500 model trajectories per series.</li>
            <li>On each day, the band goes from the 2.5% to the 97.5% quantile of those 500 values, so it holds the middle 95% of the trajectories.</li>
          </ul>
        </div>
        <div>
          <h4>95% posterior predictive interval (lighter band)</h4>
          <ul>
            <li>It uses the same 500 parameter sets, taken evenly spaced from the pooled chains, as the darker band.</li>
            <li>Every MCMC iteration saves, next to the parameter set, the noise variance {t('\\sigma^2')} drawn at that same iteration; for parameter set {t('i')}, its own {t('\\sigma_i^2')} is used.</li>
            <li>Each trajectory {t('Y_v^{(i)}(t)')} (series {t('v')}, parameter set {t('i')}) is run through the ODE model, as for the darker band, and then multiplied on each day by {t('\\exp(\\epsilon_i(t))')}, with {t('\\epsilon_i(t) \\sim \\mathcal{N}(0, \\sigma_i^2)')} drawn independently each day: the same log-scale noise the model is fit with.</li>
            <li>On each day, the band goes from the 2.5% to the 97.5% quantile of those 500 noisy values.</li>
            <li>It is the actual posterior predictive interval: the range a new observation on that day could plausibly fall in.</li>
          </ul>
        </div>
      </div>
    </Expander>
  )
}

