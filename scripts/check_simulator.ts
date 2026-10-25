// Compare the TypeScript simulator with reference output of the Python one:
//   node --experimental-strip-types scripts/check_simulator.ts sim_ref.json
import { readFileSync } from 'node:fs'
import { simulate, fittedSchedule, lockdownSchedule, schoolReopeningSchedule } from '../src/lib/simulator.ts'

const ref = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const inputs = JSON.parse(readFileSync(new URL('../public/data/sim_inputs.json', import.meta.url), 'utf8'))
let worst = 0
for (const key of Object.keys(ref)) {
  const [m, kind] = key.split('/')
  const inp = inputs[m]
  const sch = kind === 'base' ? fittedSchedule(inp.betas)
    : kind === 'lock' ? lockdownSchedule(inp.betas, 236, 14, 0.4)
    : schoolReopeningSchedule(inp.betas, 21)
  const tr = simulate(inp, sch) as any
  const parts: string[] = []
  for (const s of ['cases', 'ward', 'icu', 'deaths', 'Rt']) {
    const a: number[] = ref[key][s], b: Float64Array = tr[s]
    const peak = Math.max(...a)
    let maxRel = 0
    for (let t = 0; t < a.length; t++) maxRel = Math.max(maxRel, Math.abs(a[t] - b[t]) / peak)
    const tot = (x: ArrayLike<number>) => Array.from(x).reduce((p, v) => p + v, 0)
    parts.push(`${s} max|d|/peak=${(100 * maxRel).toFixed(3)}% tot ${(100 * (tot(b) / tot(a) - 1)).toFixed(3)}%`)
    worst = Math.max(worst, maxRel)
  }
  console.log(key.padEnd(18), parts.join(' | '))
}
console.log('worst day-by-day difference, relative to the peak:', (100 * worst).toFixed(4) + '%')
