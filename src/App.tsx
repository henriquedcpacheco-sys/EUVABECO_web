import { useEffect, useState } from 'react'
import { Activity, FileDown, FlaskConical, GitBranch, Info, Moon, Sigma, Sun, Syringe, Waypoints } from 'lucide-react'
import { Modal } from './components/ui'
import { useThemeMode } from './components/EChart'
import FitMode from './views/FitMode'
import ScenarioMode from './views/ScenarioMode'
import VaccinationMode from './views/VaccinationMode'

export type Mode = 'early' | 'partial' | 'scenarios' | 'vaccination'

const MODES: { value: Mode; n: number; title: string; caption: string; icon: typeof Activity; soon?: boolean }[] = [
  { value: 'early', n: 1, title: 'Estimate early dynamics', caption: 'Whole of 2020, fixed time period', icon: Activity },
  { value: 'partial', n: 2, title: 'Estimate partial early dynamics', caption: 'Choose the time period', icon: Waypoints },
  { value: 'scenarios', n: 3, title: 'Transmission scenarios', caption: 'Extra lockdown or later school reopening', icon: FlaskConical },
  { value: 'vaccination', n: 4, title: 'Model with vaccination', caption: 'Not available yet', icon: Syringe, soon: true },
]

const REPO_URL = 'https://github.com/henriquedcpacheco-sys/EUVABECO_web'
const BASE = import.meta.env.BASE_URL

function readMode(): Mode {
  const h = location.hash.replace('#', '') as Mode
  return MODES.some(m => m.value === h) ? h : 'early'
}

export default function App() {
  const [mode, setMode] = useState<Mode>(readMode)
  const [about, setAbout] = useState(false)
  const [scheme, setScheme] = useState(false)
  const theme = useThemeMode()

  useEffect(() => {
    history.replaceState(null, '', `#${mode}`)
  }, [mode])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('theme', next) } catch { /* private mode */ }
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-md">
        <div className="hero h-[3px]" />
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <img src={`${BASE}favicon.svg`} alt="" className="size-7" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14.5px] font-semibold">COVID-19 Model Simulator</div>
            <div className="hidden text-[11.5px] text-muted sm:block">EUVABECO · CEMAT · Portugal 2020</div>
          </div>
          <nav className="ml-auto flex items-center gap-0.5">
            <TopButton icon={Info} label="About" onClick={() => setAbout(true)} />
            <TopButton icon={Sigma} label="Model scheme" onClick={() => setScheme(true)} />
            <a href={`${BASE}data/model_reference.pdf`} download
              className="hidden h-9 items-center gap-2 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink md:inline-flex">
              <FileDown className="size-4" />Equations (PDF)
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source code on GitHub"
              className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
              <GitBranch className="size-4" />
            </a>
            <button onClick={toggleTheme} aria-label="Toggle dark mode"
              className="grid size-9 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6">
        {/* Hero */}
        <section className="hero relative mt-5 overflow-hidden rounded-2xl px-6 pb-20 pt-8 text-white shadow-pop sm:px-9 sm:pt-10">
          <HeroCurves />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/90 ring-1 ring-white/20">
              <span className="size-1.5 rounded-full bg-[#5be3c4]" />Online COVID-19 simulator
            </div>
            <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-[38px]">
              COVID-19 Model Simulator — Portugal
            </h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-white/85">
              Explore how a compartmental model fitted to Portugal's 2020 epidemic reproduces confirmed cases,
              ward and ICU occupancy and deaths, compare model versions of increasing complexity, and test
              counterfactual extra lockdowns and later school reopenings.
            </p>
            <p className="mt-4 text-[13.5px] text-white/75">
              <span className="font-semibold text-white">Henrique Pacheco</span>, CEMAT · <span className="font-semibold text-white">Erida Gjini</span>, CEMAT
            </p>
          </div>
        </section>

        {/* Mode selector, overlapping the bottom of the hero */}
        <div className="relative -mt-12 grid grid-cols-2 gap-2.5 px-2 sm:px-4 lg:grid-cols-4" role="tablist" aria-label="Simulator mode">
          {MODES.map(m => {
            const active = m.value === mode
            return (
              <button key={m.value} role="tab" aria-selected={active} onClick={() => setMode(m.value)} data-mode={m.value}
                className={`group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl border bg-surface p-3.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop ${
                  active ? 'border-primary ring-2 ring-primary/70' : 'border-line'}`}>
                <span className={`absolute inset-x-0 top-0 h-1 accent-bar ${active ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${active ? 'bg-primary text-primary-ink' : 'bg-primary-soft text-primary'}`}>
                  <m.icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-semibold text-primary">Mode {m.n}{m.soon && ' · soon'}</span>
                  <span className="block text-[13.5px] font-semibold leading-snug">{m.title}</span>
                  <span className="mt-0.5 hidden text-[12.5px] leading-snug text-muted sm:block">{m.caption}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-7" data-mode={mode}>
          {(mode === 'early' || mode === 'partial') && <FitMode key={mode} flexiblePeriod={mode === 'partial'} />}
          {mode === 'scenarios' && <ScenarioMode />}
          {mode === 'vaccination' && <VaccinationMode onPick={setMode} />}
        </div>
      </main>

      <footer className="mt-4 border-t border-line bg-surface">
        <div className="hero h-[3px]" />
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-5 text-[12.5px] text-muted sm:px-6">
          <span>
            Data: <a className="text-primary hover:underline" href="https://github.com/dssg-pt/covid19pt-data">DSSG Portugal</a>,{' '}
            <a className="text-primary hover:underline" href="https://github.com/owid/covid-19-data">Our World in Data</a> ·
            Model based on <a className="text-primary hover:underline" href="https://doi.org/10.3390/v14102114">Dings et al. (2022)</a>
          </span>
          <span>Part of the EUVABECO project</span>
        </div>
      </footer>

      <Modal open={about} onClose={() => setAbout(false)} title="Welcome to the Online COVID-19 Simulator">
        <div className="prose-app text-[14.5px] text-ink-2">
          <p>
            We provide a tool in which it is possible to explore how COVID-19 spreads in a particular setting, and how
            different factors influence the course of an outbreak, through our interactive online simulator. We have
            adjusted the model to epidemiological data from Portugal (<a href="https://github.com/dssg-pt/covid19pt-data">DSSG Portugal</a>;{' '}
            <a href="https://github.com/owid/covid-19-data">Our World in Data</a>), especially the early phase of the
            SARS-CoV-2 pandemic. We allow several model versions, based on{' '}
            <a href="https://doi.org/10.3390/v14102114">Dings et al. (2022)</a>, of increasing complexity to be employed,
            where several parameters such as transmission rates, hospitalisation probabilities and others are estimated
            to adjust model predictions to the observed time series.
          </p>
          <p>
            In addition to model calibration based on early dynamics, it is possible to investigate hypothetical
            counterfactual scenarios and observe the impact of different parameters on infection patterns over time.
            We also implement models with vaccination for later stages of the pandemic. Although we only model
            aggregated nation-level data for Portugal, the platform can be flexibly extended to model specific regional
            data of the same type and resolution.
          </p>
        </div>
      </Modal>

      <Modal open={scheme} onClose={() => setScheme(false)} title="Model scheme and equations" wide>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <img key={i} src={`${BASE}data/model_reference-${i}.png`} alt={`Model reference, page ${i}`}
              className="w-full rounded-lg border border-line bg-white" loading="lazy" />
          ))}
          <a href={`${BASE}data/model_reference.pdf`} download className="inline-flex items-center gap-2 text-[13.5px] font-medium text-primary hover:underline">
            <FileDown className="size-4" />Download the equations (PDF)
          </a>
        </div>
      </Modal>
    </div>
  )
}

function TopButton({ icon: Icon, label, onClick }: { icon: typeof Info; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink sm:px-3">
      <Icon className="size-4" /><span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/** Decorative epidemic curves in the hero, in the series colours. */
function HeroCurves() {
  return (
    <svg aria-hidden="true" viewBox="0 0 800 260" preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-[70%] opacity-60 max-md:w-full max-md:opacity-25">
      <path d="M0 230 C 120 230 150 150 200 150 S 260 225 330 225 S 470 225 540 160 S 640 40 690 60 S 760 140 800 150"
        fill="none" stroke="#56B4E9" strokeWidth="3" strokeLinecap="round" opacity=".9" />
      <path d="M0 240 C 140 240 170 185 220 185 S 290 235 360 235 S 500 232 570 190 S 660 95 710 100 S 770 160 800 165"
        fill="none" stroke="#F0B23A" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
      <path d="M0 248 C 150 248 185 205 235 205 S 300 244 380 244 S 520 240 590 215 S 680 140 730 140 S 780 185 800 190"
        fill="none" stroke="#D98FBA" strokeWidth="2.2" strokeLinecap="round" opacity=".75" />
      <path d="M0 254 C 160 254 200 228 250 228 S 320 252 400 252 S 540 250 610 236 S 700 190 745 186 S 785 210 800 214"
        fill="none" stroke="#5be3c4" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      {[200, 330, 540, 690].map(x => <line key={x} x1={x} x2={x} y1="20" y2="260" stroke="white" strokeOpacity=".18" strokeDasharray="5 6" />)}
    </svg>
  )
}
