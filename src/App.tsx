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
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
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
        <section className="pb-6 pt-8 sm:pt-10">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">Online COVID-19 simulator</div>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
            COVID-19 Model Simulator — Portugal
          </h1>
          <p className="mt-3 max-w-3xl text-[15.5px] leading-relaxed text-ink-2">
            Explore how a compartmental model fitted to Portugal's 2020 epidemic reproduces confirmed cases,
            ward and ICU occupancy and deaths, compare model versions of increasing complexity, and test
            counterfactual extra lockdowns and later school reopenings.
          </p>
          <p className="mt-3 text-[13.5px] text-muted">
            <span className="font-semibold text-ink-2">Henrique Pacheco</span>, CEMAT · <span className="font-semibold text-ink-2">Erida Gjini</span>, CEMAT
          </p>
        </section>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" role="tablist" aria-label="Simulator mode">
          {MODES.map(m => {
            const active = m.value === mode
            return (
              <button key={m.value} role="tab" aria-selected={active} onClick={() => setMode(m.value)}
                className={`group relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                  active ? 'border-primary bg-surface shadow-card ring-1 ring-primary'
                    : 'border-line bg-surface/60 hover:border-line-strong hover:bg-surface'}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? 'bg-primary text-primary-ink' : 'bg-surface-3 text-ink-2'}`}>
                  <m.icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-semibold text-muted">Mode {m.n}{m.soon && ' · soon'}</span>
                  <span className="block text-[13.5px] font-semibold leading-snug">{m.title}</span>
                  <span className="mt-0.5 hidden text-[12.5px] leading-snug text-muted sm:block">{m.caption}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-6">
          {(mode === 'early' || mode === 'partial') && <FitMode key={mode} flexiblePeriod={mode === 'partial'} />}
          {mode === 'scenarios' && <ScenarioMode />}
          {mode === 'vaccination' && <VaccinationMode onPick={setMode} />}
        </div>
      </main>

      <footer className="border-t border-line bg-surface">
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
