// Labels, fixed dates and explanatory texts shared by every mode
// (the same content as data.py / ui.py in the Streamlit app).

export type Series = 'cases' | 'ward' | 'icu' | 'deaths'
export const SERIES: Series[] = ['cases', 'ward', 'icu', 'deaths']

export const SERIES_LABELS: Record<Series, string> = {
  cases: 'Daily confirmed cases',
  ward: 'Ward occupancy',
  icu: 'ICU occupancy',
  deaths: 'Daily deaths',
}
export const SERIES_SHORT: Record<Series | 'Rt', string> = {
  cases: 'Daily cases', ward: 'General ward', icu: 'ICU', deaths: 'Daily deaths', Rt: 'Rₜ',
}

// Okabe-Ito based, readable for colour-blind viewers.
export const SERIES_COLORS: Record<Series | 'Rt', string> = {
  cases: '#0072B2', ward: '#E69F00', icu: '#CC79A7', deaths: '#D55E00', Rt: '#009E73',
}
// Lighter shade for dark mode, darker shade for the model line over its bands.
export const SERIES_COLORS_DARK_MODE: Record<Series | 'Rt', string> = {
  cases: '#56B4E9', ward: '#F0B23A', icu: '#D98FBA', deaths: '#F07A3A', Rt: '#2EC497',
}
export const SERIES_DEEP: Record<Series | 'Rt', string> = {
  cases: '#004C7A', ward: '#9A6800', icu: '#8C3F6E', deaths: '#8F3D00', Rt: '#006B4E',
}
export const COMPARE_PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00',
  '#56B4E9', '#7A5195', '#8A8F98']

/** Day 0 of the simulator and of rt.csv. */
export const DAY0 = Date.UTC(2020, 2, 1)
export const DAY_MS = 86400000
export const dayToTime = (d: number) => DAY0 + d * DAY_MS
export const timeToDay = (t: number) => Math.round((t - DAY0) / DAY_MS)

// Fixed NPI dates: event, policy date, estimated changepoint, days after policy.
export const NPI_EVENTS: [string, string, string, number][] = [
  ['State of emergency (first national lockdown)', '2020-03-18', '2020-03-30', 12],
  ['Phased deconfinement begins', '2020-05-04', '2020-05-10', 6],
  ['Schools reopen', '2020-09-14', '2020-09-14', 0],
  ['Second state of emergency', '2020-11-04', '2020-11-06', 2],
]
export const CHANGEPOINTS = NPI_EVENTS.map(e => ({ time: Date.parse(e[2]), label: e[0] }))

export const FIXED_PARAMS: [string, string][] = [
  ['σ = 1/6 per day', 'Incubation rate (latent period 6 days)'],
  ['γ_C = 1/2 per day', 'Confirmation rate (2 days infectious before confirmation)'],
  ['γ_I = 1/5 per day', 'Exit rate of the confirmed infectious stage'],
  ['α = 1/7 per day', 'Exit rate of the non-hospitalised compartment'],
  ['γ_H = 1/9 per day', 'Ward discharge rate'],
  ['γ_ICU = 1/20 per day', 'ICU discharge rate'],
  ['φ_q = 0.002', 'Fatality probability outside hospital'],
  ['N = 10 000 000', 'Population'],
  ['I₀ = 1', 'Initial infectious individuals'],
]
export const ESTIMATED_PARAMS: [string, string][] = [
  ['β (β₁…β₅)', 'Transmission rate, one value per period between NPI dates'],
  ['ψ', 'Probability that a confirmed case is hospitalised'],
  ['θ', 'Probability that a ward patient is admitted to ICU'],
  ['φ_h', 'Fatality probability in the ward'],
  ['r_c', 'ICU/ward mortality ratio, so the ICU fatality is φ_c = r_c · φ_h'],
  ['E₀', 'Initial exposed individuals'],
]

export type ModelChoice = 'sim_m1' | 'sim_m2' | 'age_nocorr' | 'age_3b'
export const MODEL_OPTIONS: Record<ModelChoice, { name: string; short: string; caption: string }> = {
  sim_m1: { name: 'Model 1 — constant', short: 'Model 1', caption: 'One hospitalisation probability ψ for the whole year' },
  sim_m2: { name: 'Model 2 — piecewise ψ', short: 'Model 2', caption: 'One value per NPI segment' },
  age_nocorr: { name: 'Model 3a — age-stratified ψ', short: 'Model 3a', caption: 'Without testing-volume coupling' },
  age_3b: { name: 'Model 3b — age-stratified ψ', short: 'Model 3b', caption: 'With testing-volume coupling' },
}
export const POINT_KEY: Record<ModelChoice, string> = {
  sim_m1: 'sim_m1', sim_m2: 'sim_m2', age_nocorr: 'age_nocorr', age_3b: 'age_point',
}
export const BAYES_KEY: Record<ModelChoice, string> = {
  sim_m1: 'sim_m1_bayes', sim_m2: 'sim_m2_bayes', age_nocorr: 'age_nocorr_bayes', age_3b: 'age_bayes',
}
export const MODEL_LABELS: Record<string, string> = {
  sim_m1: 'Model 1 — constant',
  sim_m2: 'Model 2 — piecewise ψ, one value per NPI segment',
  age_nocorr: 'Model 3a — age-stratified ψ, without testing-volume coupling',
  age_point: 'Model 3b — age-stratified ψ, with testing-volume coupling',
  sim_m1_bayes: 'Model 1 — constant · Bayesian posterior',
  sim_m2_bayes: 'Model 2 — piecewise ψ · Bayesian posterior',
  age_nocorr_bayes: 'Model 3a — age-stratified ψ, without coupling · Bayesian posterior',
  age_bayes: 'Model 3b — age-stratified ψ, with coupling · Bayesian posterior',
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const sub = (s: string) => s.replace(/\d/g, d => SUB[+d])

export function paramSymbol(name: string): string {
  const n = name.toLowerCase()
  if (/^(b|beta)[1-5]$/.test(n)) return 'β' + sub(n.slice(-1))
  if (n === 'psi0') return 'ψ₀'
  if (/^psi\d+$/.test(n)) return 'ψ' + sub(n.slice(3))
  return ({ psi: 'ψ', psi_base: 'ψ_base', theta: 'θ', phi_h: 'φ_h', r_c: 'r_c',
    f_test: 'F_test', e0: 'E₀', i0: 'I₀' } as Record<string, string>)[n] ?? name
}

export function paramMeaning(name: string): string {
  const n = name.toLowerCase()
  if (/^(b|beta)[1-5]$/.test(n)) return `Transmission rate, period ${n.slice(-1)}`
  if (n === 'psi0') return 'Baseline hospitalisation probability'
  if (/^psi\d+$/.test(n)) return `Hospitalisation probability, period ${n.slice(3)}`
  return ({
    psi: 'Hospitalisation probability',
    psi_base: 'Hospitalisation probability of the 0-49 age group (other groups: x2, x4, x8)',
    theta: 'ICU admission probability (from the ward)',
    phi_h: 'Ward fatality probability',
    r_c: 'ICU/ward mortality ratio (φ_c = r_c · φ_h)',
    f_test: 'Testing decay: how fast the hospitalisation probability falls as testing grows',
    e0: 'Initial exposed individuals',
    i0: 'Initial infectious individuals',
  } as Record<string, string>)[n] ?? ''
}

export const AGE_PARAM_NOTES = {
  '3a': 'This variant adds one kind of parameter beyond Models 1/2: **ψ_base**, the ' +
    'hospitalisation probability of the 0-49 age group (the 50-59, 60-69 and 70+ groups use ' +
    '2x, 4x and 8x ψ_base, mixed each day by that day\'s case age composition). There is no ' +
    'testing-volume coupling here, so no F_test parameter.',
  '3b': 'This variant adds two kinds of parameter beyond Models 1/2: **ψ_base**, the ' +
    'hospitalisation probability of the 0-49 age group (the 50-59, 60-69 and 70+ groups use ' +
    '2x, 4x and 8x ψ_base, mixed each day by that day\'s case age composition); and ' +
    '**F_test**, how fast the testing-volume coupling Ch(t) pulls ψ down as testing increases.',
}
