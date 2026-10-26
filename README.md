# COVID-19 Model Simulator — Portugal (web)

Interactive simulator of the SEIQHICURD model fitted to Portugal's 2020 epidemic
(EUVABECO project, CEMAT). Henrique Pacheco and Erida Gjini.

**Live:** https://henriquedcpacheco-sys.github.io/EUVABECO_web/

It is a static web app (React + TypeScript + Vite + Tailwind CSS, charts with
ECharts), so it runs entirely in the browser and is hosted for free on GitHub
Pages. Every push to `main` rebuilds and redeploys it
(`.github/workflows/deploy.yml`).

## Modes

1. **Estimate early dynamics**: the fitted models (1, 2, 3a, 3b) over the whole
   of 2020. A run shows the least-squares fit; a toggle in the results then
   switches to the Bayesian MCMC posterior (credible and predictive bands).
2. **Estimate partial early dynamics**: the same, for a chosen period.
3. **Transmission scenarios**: an extra lockdown (Rₜ reduction on top of the
   fitted transmission, any start date and duration outside the two real
   lockdowns) or a later school reopening, re-simulated live in the browser;
   save runs and compare them. For the Model 3b baseline, a toggle in the results
   adds the 95% band from 500 posterior draws.
4. **Model with vaccination**: not available yet.

## How it works

- Nothing is fitted in the browser. The fits are those of the MATLAB pipeline
  (least squares) and the mcmcstat DRAM runs (Bayesian bands), exported to
  `public/data/*.json` by `scripts/build_data.py` from the `data/` folder of
  the [Streamlit app](https://github.com/henriquedcpacheco-sys/EUVABECO_sim).
- The scenarios re-integrate the ODE in `src/lib/simulator.ts`, a port of
  `d2_rhs.m` / `simulator.py` (RK4, 20 steps per day). It matches the Python
  simulator within 0.001% of each series' peak; check with
  `scripts/check_simulator.ts`.
- The Model 3b predictive band in the scenarios integrates 500 posterior draws
  in a Web Worker (`src/lib/bandsWorker.ts`).

## Develop

```bash
npm install
npm run dev          # http://localhost:5173/EUVABECO_web/
npm run build        # production build in dist/
```

After new MATLAB/MCMC exports, refresh the data:

```bash
python scripts/build_data.py ../EUVABECO_sim/data
```

## Files

| Path | What it holds |
|---|---|
| `src/App.tsx` | Top bar, header, mode selector, About and model-scheme dialogs |
| `src/views/FitMode.tsx` | Modes 1 and 2: data, parameters, fitted model and its views, ZIP download |
| `src/views/ScenarioMode.tsx` | Mode 3: scenario setup, results, saved simulations, compare |
| `src/views/shared.tsx` | Overlay picker, epidemic metrics, chart grid |
| `src/lib/simulator.ts` | The ODE model, scenario schedules, posterior-draw band |
| `src/lib/charts.ts` | ECharts option builders (time panels, overlay, residuals, histograms, compare) |
| `src/lib/model.ts` | Labels, colours, NPI dates, parameter names and meanings |
| `src/components/ui.tsx` | Buttons, sliders, tabs, tables, dialogs |
| `public/data/` | Precomputed results (JSON), model reference PNG/PDF |

Data: [DSSG Portugal](https://github.com/dssg-pt/covid19pt-data),
[Our World in Data](https://github.com/owid/covid-19-data). Model based on
[Dings et al. (2022)](https://doi.org/10.3390/v14102114).
