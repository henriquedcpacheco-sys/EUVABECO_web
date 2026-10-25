// Loads the precomputed results in public/data (built by scripts/build_data.py).
import { useEffect, useState } from 'react'
import type { Series } from './model'
import type { AgeDraws, ModelInputs } from './simulator'

type BySeries = Record<Series, number[]>
type JRow = Record<Series | 'total', number>

export interface Observed extends BySeries { start: string; n: number }

export interface PointFit {
  sim: BySeries
  params: { name: string; value: number }[]
  J: JRow
  rt: number[]
}

export interface BayesParam {
  name: string; point_est: number; post_mean: number; ci_low: number; ci_high: number
}
export interface BayesFit {
  bands: Record<'point_est' | 'pred_lo' | 'pred_hi' | 'obs_lo' | 'obs_hi', BySeries>
  params: BayesParam[]
  fit: Record<'J_post_mean_params' | 'J_draws_mean' | 'J_draws_lo' | 'J_draws_hi', JRow>
  sigma2: Record<string, number>
  nDraws: number
  hist: Record<string, { edges: number[]; counts: number[] }>
  rt: number[]
}

export interface Comparison {
  order: string[]
  models: Record<string, { params: Record<string, number | null>; nEst: number; J: JRow }>
}

const cache = new Map<string, Promise<unknown>>()

export function load<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${import.meta.env.BASE_URL}data/${name}.json`).then(r => {
      if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`)
      return r.json()
    }))
  }
  return cache.get(name) as Promise<T>
}

export const loadObserved = () => load<Observed>('observed')
export const loadPoint = (key: string) => load<PointFit>(key)
export const loadBayes = (key: string) => load<BayesFit>(key)
export const loadComparison = () => load<Comparison>('comparison')
export const loadSimInputs = () => load<Record<string, ModelInputs>>('sim_inputs')
export const loadAgeDraws = () => load<AgeDraws>('age_draws')

/** React hook around load(): undefined while loading. */
export function useData<T>(name: string | null): T | undefined {
  const [state, setState] = useState<{ name: string | null; value?: T }>({ name: null })
  useEffect(() => {
    if (!name) return
    let live = true
    load<T>(name).then(v => { if (live) setState({ name, value: v }) })
    return () => { live = false }
  }, [name])
  return state.name === name ? state.value : undefined
}
