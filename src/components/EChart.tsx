import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent,
  TitleComponent, TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

echarts.use([LineChart, BarChart, ScatterChart, CustomChart, GridComponent, TooltipComponent,
  LegendComponent, MarkLineComponent, MarkAreaComponent, TitleComponent, DataZoomComponent,
  CanvasRenderer])

export type Option = EChartsCoreOption

// ---------------------------------------------------------------------------
// Theme: follows the page (data-theme attribute, or the OS preference).
// ---------------------------------------------------------------------------
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function currentMode(): 'light' | 'dark' {
  const t = document.documentElement.dataset.theme
  if (t === 'light' || t === 'dark') return t
  return media?.matches ? 'dark' : 'light'
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  media?.addEventListener('change', cb)
  return () => { obs.disconnect(); media?.removeEventListener('change', cb) }
}

export function useThemeMode() {
  return useSyncExternalStore(subscribe, currentMode, () => 'light' as const)
}

export interface ChartTheme {
  mode: 'light' | 'dark'
  text: string
  muted: string
  grid: string
  axis: string
  rule: string
  surface: string
  tooltipBg: string
  tooltipBorder: string
  obs: string
  window: string
}

export function chartTheme(mode: 'light' | 'dark'): ChartTheme {
  return mode === 'dark'
    ? { mode, text: '#e6eaf0', muted: '#8b95a6', grid: '#222c39', axis: '#3a4658', rule: '#7d889a',
        surface: '#131a23', tooltipBg: '#1b2430', tooltipBorder: '#34425a', obs: '#9aa3b2',
        window: '#f07a55' }
    : { mode, text: '#172033', muted: '#6b7587', grid: '#eceff3', axis: '#c5ccd6', rule: '#7a808a',
        surface: '#ffffff', tooltipBg: '#ffffff', tooltipBorder: '#e1e6ed', obs: '#8a8f98',
        window: '#e4572e' }
}

// ---------------------------------------------------------------------------
// Chart component
// ---------------------------------------------------------------------------
export function EChart({ option, height = 260, className = '' }:
  { option: Option; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inst = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    inst.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect(); chart.dispose(); inst.current = null }
  }, [])

  useEffect(() => {
    inst.current?.setOption(option, { notMerge: true })
  }, [option])

  return <div ref={ref} style={{ height }} className={`w-full ${className}`} />
}

// ---------------------------------------------------------------------------
// PNG export: charts are re-rendered off-screen in the light theme and laid
// out on one canvas, with a title.
// ---------------------------------------------------------------------------
async function renderOne(option: Option, w: number, h: number): Promise<HTMLImageElement> {
  const div = document.createElement('div')
  div.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px`
  document.body.appendChild(div)
  const chart = echarts.init(div, undefined, { renderer: 'canvas', width: w, height: h })
  chart.setOption({ ...option, animation: false })
  const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
  chart.dispose()
  div.remove()
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}

export async function exportPng(options: Option[], { cols = 1, width = 820, height = 300,
  title = '' } = {}): Promise<Blob> {
  const imgs = await Promise.all(options.map(o => renderOne(o, width, height)))
  const rows = Math.ceil(imgs.length / cols)
  const gap = 16, top = title ? 46 : 12, px = 2
  const W = cols * width + (cols - 1) * gap + 24, H = top + rows * height + (rows - 1) * gap + 12
  const canvas = document.createElement('canvas')
  canvas.width = W * px
  canvas.height = H * px
  const ctx = canvas.getContext('2d')!
  ctx.scale(px, px)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  if (title) {
    ctx.fillStyle = '#172033'
    ctx.font = '600 17px "Inter Variable", system-ui, sans-serif'
    ctx.fillText(title, 14, 30)
  }
  imgs.forEach((img, i) => {
    const r = Math.floor(i / cols), c = i % cols
    ctx.drawImage(img, 12 + c * (width + gap), top + r * (height + gap), width, height)
  })
  return new Promise(res => canvas.toBlob(b => res(b!), 'image/png'))
}
