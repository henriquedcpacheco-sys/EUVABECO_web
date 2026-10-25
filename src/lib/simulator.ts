// Forward simulator: a port of the thesis ODE (Tese/D2/d2_rhs.m, d2_forward.m)
// and of simulator.py in the Streamlit app. The model is integrated segment by
// segment, one constant beta per segment, with classical Runge-Kutta 4 on a
// fixed step that divides the day, so every segment boundary and every daily
// change of psi(t) falls exactly on a step. Output is on days 0..305
// (day 0 = 01/03/2020).

export const SIG = 1 / 6, GC = 1 / 2, GI = 1 / 5, ALPHA = 1 / 7, GH = 1 / 9, GICU = 1 / 20
export const PHIQ = 0.002
export const N_POP = 1e7
export const TOTINF = 1 / GC + 1 / GI // = 7 days, so R0 = 7 beta
export const FITTED_CP = [29, 70, 197, 250] // day of each fitted beta switch
export const N_DAYS = 306
export const AGE_NTNORM = 12632 // Ch(t) = exp(-F_test NT(t) / AGE_NTNORM)
export const AGE_MULT = [1, 2, 4, 8] // psi_a / psi_base per age group

export interface ModelInputs {
  betas: number[]
  theta: number
  phi_h: number
  phi_c: number
  E0: number
  I0: number
  psi: number[] // per-day hospitalisation probability, length N_DAYS
}

/** [start_day, end_day, beta]: beta is constant on [start, end). */
export type Segment = [number, number, number]

export interface Trajectory {
  cases: Float64Array
  ward: Float64Array
  icu: Float64Array
  deaths: Float64Array
  Rt: Float64Array
  beta: Float64Array
}

const CPS = [0, ...FITTED_CP, N_DAYS - 1]

export function fittedSchedule(betas: number[]): Segment[] {
  return betas.map((b, k) => [CPS[k], CPS[k + 1], b] as Segment)
}

/** Extra Rt reduction on top of the fitted transmission: from startDay, for
 * `duration` days, the fitted beta(t) is multiplied by (1 - reduction).
 * Outside that window beta(t) is as fitted. */
export function lockdownSchedule(betas: number[], startDay: number, duration: number,
                                 reduction: number): Segment[] {
  const end = Math.min(startDay + duration, N_DAYS - 1)
  const bounds = [...new Set([...CPS, startDay, end])].sort((a, b) => a - b)
  const out: Segment[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i], b = bounds[i + 1]
    let k = 0
    for (let j = 0; j < 5; j++) if (CPS[j] <= a) k = j
    const inWindow = startDay <= a && a < end
    out.push([a, b, betas[k] * (inWindow ? 1 - reduction : 1)])
  }
  return out
}

/** Later school reopening: the fitted switch on 14/09/2020 (FITTED_CP[2]) is
 * pushed `delay` days later, capped before the next real changepoint. */
export function schoolReopeningSchedule(betas: number[], delay: number): Segment[] {
  const c = [...CPS]
  c[3] = Math.min(c[3] + delay, c[4] - 1)
  return betas.map((b, k) => [c[k], c[k + 1], b] as Segment)
}

const STEPS_PER_DAY = 20

function rhs(y: Float64Array, dy: Float64Array, beta: number, p: number,
             theta: number, phi_h: number, phi_c: number) {
  const S = y[0], E = y[1], Iuc = y[2], Ic = y[3], Ti = y[4], H = y[5], ICU = y[6]
  const lam = beta * (Iuc + Ic) / (S + E + Iuc + Ic + Ti + H + ICU + y[7] + y[8])
  dy[0] = -lam * S
  dy[1] = lam * S - SIG * E
  dy[2] = SIG * E - GC * Iuc
  dy[3] = GC * Iuc - GI * Ic
  dy[4] = (1 - p) * GI * Ic - ALPHA * Ti
  dy[5] = p * GI * Ic - GH * H
  dy[6] = GH * theta * H - GICU * ICU
  dy[7] = (1 - PHIQ) * ALPHA * Ti + (1 - phi_h) * GH * (1 - theta) * H + (1 - phi_c) * GICU * ICU
  dy[8] = PHIQ * ALPHA * Ti + phi_h * GH * (1 - theta) * H + phi_c * GICU * ICU
  dy[9] = GC * Iuc
}

/** Integrate one parameter set over days 0..305 for a piecewise-constant
 * beta schedule covering the whole period. Returns the full state per day
 * (10 x N_DAYS, row-major by day) and beta per day. */
function integrate(inp: ModelInputs, schedule: Segment[], stepsPerDay = STEPS_PER_DAY) {
  const f0 = (1 / GC) / (1 / GC + 1 / GI)
  let y = new Float64Array([N_POP - inp.E0 - inp.I0, inp.E0, inp.I0 * f0, inp.I0 * (1 - f0),
    0, 0, 0, 0, 0, 0])
  const out = new Float64Array(N_DAYS * 10)
  const betaDay = new Float64Array(N_DAYS)
  const k1 = new Float64Array(10), k2 = new Float64Array(10)
  const k3 = new Float64Array(10), k4 = new Float64Array(10), tmp = new Float64Array(10)
  const h = 1 / stepsPerDay
  out.set(y, 0)
  for (const [a, b, beta] of schedule) {
    if (b - a < 1) continue
    for (let day = a; day < b; day++) {
      // psi is the value of the day being integrated (floor(t) in d2_rhs).
      const p = inp.psi[Math.min(Math.max(day, 0), N_DAYS - 1)]
      for (let s = 0; s < stepsPerDay; s++) {
        rhs(y, k1, beta, p, inp.theta, inp.phi_h, inp.phi_c)
        for (let i = 0; i < 10; i++) tmp[i] = y[i] + 0.5 * h * k1[i]
        rhs(tmp, k2, beta, p, inp.theta, inp.phi_h, inp.phi_c)
        for (let i = 0; i < 10; i++) tmp[i] = y[i] + 0.5 * h * k2[i]
        rhs(tmp, k3, beta, p, inp.theta, inp.phi_h, inp.phi_c)
        for (let i = 0; i < 10; i++) tmp[i] = y[i] + h * k3[i]
        rhs(tmp, k4, beta, p, inp.theta, inp.phi_h, inp.phi_c)
        const ny = new Float64Array(10)
        for (let i = 0; i < 10; i++) ny[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
        y = ny
      }
      out.set(y, (day + 1) * 10)
    }
    for (let d = a; d <= b; d++) betaDay[d] = beta
  }
  return { out, betaDay }
}

export function simulate(inp: ModelInputs, schedule: Segment[]): Trajectory {
  const { out, betaDay } = integrate(inp, schedule)
  const tr: Trajectory = {
    cases: new Float64Array(N_DAYS), ward: new Float64Array(N_DAYS),
    icu: new Float64Array(N_DAYS), deaths: new Float64Array(N_DAYS),
    Rt: new Float64Array(N_DAYS), beta: betaDay,
  }
  for (let d = 0; d < N_DAYS; d++) {
    const o = d * 10, prev = (d - 1) * 10
    tr.cases[d] = Math.max(out[o + 9] - (d ? out[prev + 9] : 0), 0)
    tr.deaths[d] = Math.max(out[o + 8] - (d ? out[prev + 8] : 0), 0)
    tr.ward[d] = out[o + 5]
    tr.icu[d] = out[o + 6]
    tr.Rt[d] = betaDay[d] * TOTINF * out[o] / N_POP
  }
  return tr
}

// ---------------------------------------------------------------------------
// Model 3b posterior draws (scenario predictive band)
// ---------------------------------------------------------------------------
export interface AgeDraws {
  draws: Record<string, number[]> // beta1..5, theta, phi_h, r_c, psi_base, E0, F_test, sigma2
  NT: number[]
  mix: number[][] // per day: share of new cases in 0-49, 50-59, 60-69, 70+
}

/** Mulberry32: small seeded generator, so the band is the same on every run. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(u: () => number) {
  return Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u())
}

function quantile(sorted: Float64Array, q: number) {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export type BandSeries = 'cases' | 'ward' | 'icu' | 'deaths'
export type Bands = Record<BandSeries, { lo: Float64Array; hi: Float64Array }>

/** 95% posterior-predictive band of the fitted Model 3b baseline: each draw is
 * integrated with its own parameters and psi(t) (rebuilt from the age mix and
 * the testing volume), then multiplied each day by exp(eps), eps ~ N(0,
 * sigma2_i), the log-scale noise the model is fitted with. Same method as
 * simulate_draws in the Streamlit app. */
export function predictiveBands(ad: AgeDraws): Bands {
  const D = ad.draws, n = D.beta1.length
  const series: BandSeries[] = ['cases', 'ward', 'icu', 'deaths']
  const vals = Object.fromEntries(series.map(s => [s, new Float64Array(n * N_DAYS)])) as
    Record<BandSeries, Float64Array>
  const m = ad.mix.map(p => p.reduce((acc, v, i) => acc + v * AGE_MULT[i], 0))
  const u = rng(20231024)
  for (let i = 0; i < n; i++) {
    const betas = [1, 2, 3, 4, 5].map(k => D[`beta${k}`][i])
    const psi = m.map((mt, t) => Math.exp(-D.F_test[i] * ad.NT[t] / AGE_NTNORM) * D.psi_base[i] * mt)
    const tr = simulate({
      betas, theta: D.theta[i], phi_h: D.phi_h[i], phi_c: D.r_c[i] * D.phi_h[i],
      E0: D.E0[i], I0: 1, psi,
    }, fittedSchedule(betas))
    const sd = Math.sqrt(D.sigma2[i])
    for (const s of series) {
      const arr = tr[s], dst = vals[s]
      for (let t = 0; t < N_DAYS; t++) {
        const mu = Math.log(Math.max(arr[t], 0) + 1)
        dst[t * n + i] = Math.exp(mu + gaussian(u) * sd) - 1
      }
    }
  }
  const bands = {} as Bands
  for (const s of series) {
    const lo = new Float64Array(N_DAYS), hi = new Float64Array(N_DAYS)
    for (let t = 0; t < N_DAYS; t++) {
      const day = vals[s].slice(t * n, (t + 1) * n).sort()
      lo[t] = quantile(day, 0.025)
      hi[t] = quantile(day, 0.975)
    }
    bands[s] = { lo, hi }
  }
  return bands
}
