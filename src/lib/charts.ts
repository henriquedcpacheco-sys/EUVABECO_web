// ECharts option builders. Every time chart is drawn the same way: a light
// grid, the fixed NPI changepoints as dashed rules (hover one for its event),
// and a crosshair tooltip with the values of the day under the pointer.
import type { ChartTheme, Option } from '../components/EChart'
import { CHANGEPOINTS, COMPARE_PALETTE, DAY_MS } from './model'
import { compact, fmtDate, fmtNum } from './format'

export interface Window { a: number; b: number; label: string }

export type Layer =
  | { kind: 'dots'; name: string; values: ArrayLike<number>; color: string }
  | { kind: 'line'; name: string; values: ArrayLike<number>; color: string; width?: number; dash?: boolean }
  | { kind: 'band'; name: string; lo: ArrayLike<number>; hi: ArrayLike<number>; color: string; opacity: number }

export interface TipRow { label: string; values: ArrayLike<number>; digits?: number }

export interface PanelSpec {
  ct: ChartTheme
  title?: string
  times: number[] // one timestamp per array element
  start: number
  end: number
  layers: Layer[]
  tips: TipRow[]
  window?: Window | null
  rtLine?: boolean
  yName?: string
  yDigits?: number // fixed decimals on the y axis (Rt), else compact labels
  showChangepoints?: boolean
}

const FONT = '"Inter Variable", system-ui, sans-serif'

function base(ct: ChartTheme, title?: string): Option {
  return {
    animationDuration: 300,
    textStyle: { fontFamily: FONT, color: ct.text },
    title: title ? {
      text: title, left: 4, top: 2,
      textStyle: { fontSize: 13, fontWeight: 600, color: ct.text, fontFamily: FONT },
    } : undefined,
    tooltip: {
      trigger: 'axis', confine: true, backgroundColor: ct.tooltipBg, borderColor: ct.tooltipBorder,
      textStyle: { color: ct.text, fontSize: 12, fontFamily: FONT }, padding: [8, 10],
      extraCssText: 'box-shadow:0 8px 24px -6px rgba(16,24,40,.25);border-radius:8px;',
      axisPointer: { type: 'line', lineStyle: { color: ct.rule, width: 1, opacity: 0.6 } },
    },
  }
}

/** Zoom and pan on the x axis: Ctrl + scroll (or a trackpad pinch) zooms, a
 * drag pans, a double-click resets (see EChart). Plain scrolling is left to
 * the page; the y axis rescales to the data in view. */
const zoom = (filterMode: 'filter' | 'weakFilter' = 'filter', xAxisIndex = 0) => [{
  type: 'inside', xAxisIndex, filterMode, zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false,
  moveOnMouseMove: true, preventDefaultMouseMove: true,
}]

const timeAxis = (ct: ChartTheme, start: number, end: number) => ({
  type: 'time', min: start, max: end,
  axisLine: { lineStyle: { color: ct.axis } }, axisTick: { show: false },
  splitLine: { show: false },
  axisLabel: { color: ct.muted, fontSize: 11, hideOverlap: true,
    formatter: { year: '{yyyy}', month: '{MMM}', day: '{d} {MMM}' } },
})

const valueAxis = (ct: ChartTheme, digits?: number, name?: string) => ({
  type: 'value', name, nameTextStyle: { color: ct.muted, fontSize: 11, align: 'left' },
  splitNumber: 4, axisLine: { show: false }, axisTick: { show: false },
  splitLine: { lineStyle: { color: ct.grid } },
  axisLabel: { color: ct.muted, fontSize: 11,
    formatter: (v: number) => digits != null ? v.toFixed(digits) : compact(v) },
})

function changepointLines(ct: ChartTheme, start: number, end: number) {
  return CHANGEPOINTS.filter(c => c.time >= start && c.time <= end).map(c => ({
    xAxis: c.time, name: c.label,
    label: { show: false },
    emphasis: { label: { show: true, formatter: `${c.label}\n${fmtDate(c.time)}`, color: ct.text,
      backgroundColor: ct.tooltipBg, borderColor: ct.tooltipBorder, borderWidth: 1, padding: [4, 6],
      borderRadius: 4, fontSize: 11, position: 'insideEndTop' } },
  }))
}

function marks(ct: ChartTheme, spec: Pick<PanelSpec, 'start' | 'end' | 'window' | 'rtLine' | 'showChangepoints'>) {
  const lines: object[] = spec.showChangepoints === false ? [] : changepointLines(ct, spec.start, spec.end)
  if (spec.rtLine) {
    lines.push({ yAxis: 1, name: 'Rₜ = 1', lineStyle: { type: [2, 3], color: ct.rule, width: 1 },
      label: { show: false }, emphasis: { disabled: true } })
  }
  const out: Record<string, unknown> = {
    markLine: { silent: false, symbol: 'none', animation: false,
      lineStyle: { type: [5, 4], color: ct.rule, width: 1.1, opacity: 0.9 }, data: lines },
  }
  const w = spec.window
  if (w) {
    const a = Math.max(w.a, spec.start), b = Math.min(w.b, spec.end)
    if (a < b) {
      out.markArea = { silent: true, itemStyle: { color: ct.window, opacity: 0.12 },
        data: [[{ xAxis: a, name: w.label, label: { show: false } }, { xAxis: b }]] }
    }
  }
  return out
}

/** Indices of `times` inside [start, end]. */
function inRange(times: number[], start: number, end: number): number[] {
  const idx: number[] = []
  times.forEach((t, i) => { if (t >= start && t <= end) idx.push(i) })
  return idx
}

export function timePanel(spec: PanelSpec): Option {
  const { ct, times, start, end } = spec
  const idx = inRange(times, start, end)
  const pts = (v: ArrayLike<number>) => idx.map(i => [times[i], v[i]])
  const series: object[] = []
  spec.layers.forEach((L, li) => {
    if (L.kind === 'band') {
      const stack = `band${li}`
      series.push({ type: 'line', name: L.name + ' (low)', stack, symbol: 'none', silent: true,
        lineStyle: { opacity: 0 }, data: idx.map(i => [times[i], Math.max(L.lo[i], 0)]),
        tooltip: { show: false } })
      series.push({ type: 'line', name: L.name, stack, symbol: 'none', silent: true,
        lineStyle: { opacity: 0 }, areaStyle: { color: L.color, opacity: L.opacity },
        data: idx.map(i => [times[i], Math.max(L.hi[i], 0) - Math.max(L.lo[i], 0)]) })
    } else if (L.kind === 'dots') {
      series.push({ type: 'scatter', name: L.name, symbolSize: 4.5, data: pts(L.values),
        itemStyle: { color: L.color, opacity: 0.75 }, emphasis: { scale: 1.6 } })
    } else {
      series.push({ type: 'line', name: L.name, symbol: 'none', smooth: false, data: pts(L.values),
        lineStyle: { color: L.color, width: L.width ?? 2.2, type: L.dash ? [6, 4] : 'solid' },
        itemStyle: { color: L.color }, emphasis: { disabled: true } })
    }
  })
  // Rules and the scenario window ride on an empty helper series.
  series.push({ type: 'line', name: '_marks', data: [], silent: false, ...marks(ct, spec) })

  const b = base(ct, spec.title)
  return {
    ...b,
    grid: { left: 8, right: 14, top: spec.title ? 38 : 16, bottom: 6, containLabel: true },
    xAxis: timeAxis(ct, start, end),
    dataZoom: zoom(),
    yAxis: valueAxis(ct, spec.yDigits, spec.yName),
    series,
    tooltip: {
      ...(b.tooltip as object),
      formatter: (params: { dataIndex: number }[]) => {
        const p = params.find(x => x != null)
        if (!p) return ''
        const i = idx[p.dataIndex]
        if (i == null) return ''
        const rows = spec.tips.map(r =>
          `<div style="display:flex;justify-content:space-between;gap:16px"><span style="opacity:.75">${r.label}</span>` +
          `<b style="font-variant-numeric:tabular-nums">${fmtNum(r.values[i], r.digits ?? 0)}</b></div>`).join('')
        return `<div style="font-weight:600;margin-bottom:4px">${fmtDate(times[i])}</div>${rows}`
      },
    },
  }
}

export interface OverlaySide { name: string; times: number[]; values: ArrayLike<number>; color: string; isRt: boolean }

/** Two series on one time axis, each with its own y-axis (left / right). */
export function overlayChart(ct: ChartTheme, start: number, end: number, left: OverlaySide, right: OverlaySide,
  window?: Window | null, title?: string): Option {
  const b = base(ct, title)
  const axis = (s: OverlaySide, pos: 'left' | 'right') => ({
    ...valueAxis(ct, s.isRt ? 1 : undefined), position: pos, name: s.name,
    nameTextStyle: { color: s.color, fontWeight: 600, fontSize: 12, align: pos === 'left' ? 'left' : 'right' },
    axisLabel: { color: s.color, fontSize: 11, formatter: (v: number) => s.isRt ? v.toFixed(1) : compact(v) },
    splitLine: { show: pos === 'left', lineStyle: { color: ct.grid } },
  })
  const line = (s: OverlaySide, yAxisIndex: number) => ({
    type: 'line', name: s.name, yAxisIndex, symbol: 'none',
    data: inRange(s.times, start, end).map(i => [s.times[i], s.values[i]]),
    lineStyle: { color: s.color, width: 2.3 }, itemStyle: { color: s.color },
    ...(s.isRt ? { markLine: { symbol: 'none', silent: true, label: { show: false },
      lineStyle: { type: [2, 3], color: s.color, opacity: 0.7 }, data: [{ yAxis: 1 }] } } : {}),
  })
  return {
    ...b,
    grid: { left: 8, right: 8, top: title ? 84 : 62, bottom: 6, containLabel: true },
    xAxis: timeAxis(ct, start, end),
    dataZoom: zoom(),
    yAxis: [axis(left, 'left'), axis(right, 'right')],
    series: [line(left, 0), line(right, 1),
      { type: 'line', data: [], ...marks(ct, { start, end, window }) }],
    tooltip: {
      ...(b.tooltip as object),
      formatter: (params: { seriesIndex: number; value: number[] }[]) => {
        const ps = params.filter(x => x.seriesIndex < 2 && x.value)
        if (!ps.length) return ''
        const row = (x: { seriesIndex: number; value: number[] }) => {
          const s = x.seriesIndex === 0 ? left : right
          return `<div style="display:flex;justify-content:space-between;gap:16px">` +
            `<span style="color:${s.color};font-weight:600">${s.name}</span><b>${fmtNum(x.value[1], s.isRt ? 3 : 1)}</b></div>`
        }
        return `<div style="font-weight:600;margin-bottom:4px">${fmtDate(ps[0].value[0])}</div>${ps.map(row).join('')}`
      },
    },
  }
}

/** Stacked weekly squared log-residuals: weeks = [weekStart, value per stack]. */
export function residualChart(ct: ChartTheme, weeks: number[], stacks: { name: string; color: string; values: number[] }[],
  start: number, end: number, title?: string): Option {
  const b = base(ct, title)
  const cum = weeks.map(() => 0)
  const series = stacks.map(s => {
    const data = weeks.map((w, i) => {
      const y0 = cum[i], y1 = y0 + s.values[i]
      cum[i] = y1
      return [w, w + 7 * DAY_MS, y0, y1, s.values[i]]
    })
    return {
      type: 'custom', clip: true, name: s.name, itemStyle: { color: s.color },
      encode: { x: [0, 1], y: [2, 3] },
      renderItem: (_: unknown, api: any) => {
        const p0 = api.coord([api.value(0), api.value(2)]), p1 = api.coord([api.value(1), api.value(3)])
        return { type: 'rect', shape: { x: p0[0] + 1, y: p1[1], width: Math.max(p1[0] - p0[0] - 2, 1),
          height: p0[1] - p1[1] }, style: { fill: s.color } }
      },
      data,
    }
  })
  return {
    ...b,
    legend: { top: title ? 28 : 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10,
      textStyle: { color: ct.text, fontSize: 12 } },
    grid: { left: 8, right: 14, top: title ? 64 : 36, bottom: 6, containLabel: true },
    xAxis: timeAxis(ct, start, end),
    dataZoom: zoom('weakFilter'),
    yAxis: valueAxis(ct, 0),
    series: [...series, { type: 'line', data: [], ...marks(ct, { start, end }) }],
    tooltip: {
      ...(b.tooltip as object), trigger: 'item',
      formatter: (p: { seriesName: string; value: number[] }) =>
        `<div style="font-weight:600">Week of ${fmtDate(p.value[0])}</div>${p.seriesName}: <b>${fmtNum(p.value[4], 2)}</b>`,
    },
  }
}

/** Posterior histogram with its 95% CI, posterior mean and least-squares estimate. */
export function histogramChart(ct: ChartTheme, title: string, edges: number[], counts: number[],
  mean: number, ls: number, lo: number, hi: number): Option {
  const b = base(ct, title)
  const xmin = Math.min(edges[0], ls, lo), xmax = Math.max(edges[edges.length - 1], ls, hi)
  return {
    ...b,
    grid: { left: 6, right: 10, top: 32, bottom: 4, containLabel: true },
    dataZoom: zoom('weakFilter'),
    xAxis: { type: 'value', min: xmin, max: xmax, splitNumber: 3, axisLine: { lineStyle: { color: ct.axis } },
      axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { color: ct.muted, fontSize: 10, hideOverlap: true, formatter: (v: number) => compact(v) } },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'custom', clip: true, name: title, itemStyle: { color: ct.obs },
      encode: { x: [0, 1], y: 2 },
      renderItem: (_: unknown, api: any) => {
        const p0 = api.coord([api.value(0), 0]), p1 = api.coord([api.value(1), api.value(2)])
        return { type: 'rect', shape: { x: p0[0], y: p1[1], width: Math.max(p1[0] - p0[0] - 0.6, 0.5),
          height: p0[1] - p1[1] }, style: { fill: ct.obs, opacity: 0.8 } }
      },
      data: counts.map((c, i) => [edges[i], edges[i + 1], c]),
      markArea: { silent: true, itemStyle: { color: ct.window, opacity: 0.1 }, data: [[{ xAxis: lo }, { xAxis: hi }]] },
      markLine: { symbol: 'none', silent: true, label: { show: false }, animation: false, data: [
        { xAxis: mean, lineStyle: { color: ct.window, width: 2, type: 'solid' } },
        { xAxis: ls, lineStyle: { color: ct.text, width: 1.4, type: [4, 3], opacity: 0.7 } },
      ] },
    }],
    tooltip: {
      ...(b.tooltip as object), trigger: 'item',
      formatter: (p: { value: number[] }) =>
        `${+p.value[0].toPrecision(4)} – ${+p.value[1].toPrecision(4)}<br><b>${p.value[2]}</b> draws`,
    },
  }
}

/** One line per saved simulation. */
export function compareChart(ct: ChartTheme, items: { name: string; times: number[]; values: ArrayLike<number> }[],
  yName: string, isRt: boolean, title?: string): Option {
  const b = base(ct, title)
  const start = Math.min(...items.map(s => s.times[0])), end = Math.max(...items.map(s => s.times[s.times.length - 1]))
  return {
    ...b,
    legend: { bottom: 0, left: 0, orient: 'vertical', icon: 'roundRect', itemWidth: 14, itemHeight: 4, itemGap: 8,
      textStyle: { color: ct.text, fontSize: 12 } },
    grid: { left: 8, right: 14, top: title ? 40 : 24, bottom: 14 + 20 * items.length, containLabel: true },
    xAxis: timeAxis(ct, start, end),
    dataZoom: zoom(),
    yAxis: valueAxis(ct, isRt ? 1 : undefined, yName),
    series: [
      ...items.map((s, k) => ({
        type: 'line', name: s.name, symbol: 'none', data: s.times.map((t, i) => [t, s.values[i]]),
        lineStyle: { width: 2.2, color: COMPARE_PALETTE[k % COMPARE_PALETTE.length] },
        itemStyle: { color: COMPARE_PALETTE[k % COMPARE_PALETTE.length] },
      })),
      { type: 'line', data: [], ...marks(ct, { start, end, rtLine: isRt }) },
    ],
    tooltip: {
      ...(b.tooltip as object),
      formatter: (params: { seriesName: string; value: number[]; color: string }[]) => {
        const ps = params.filter(p => p.seriesName && p.value)
        if (!ps.length) return ''
        return `<div style="font-weight:600;margin-bottom:4px">${fmtDate(ps[0].value[0])}</div>` + ps.map(p =>
          `<div style="display:flex;justify-content:space-between;gap:16px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}</span>` +
          `<b>${fmtNum(p.value[1], isRt ? 3 : 1)}</b></div>`).join('')
      },
    },
  }
}
