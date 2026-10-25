import { Syringe } from 'lucide-react'
import { Button, EmptyState } from '../components/ui'
import type { Mode } from '../App'

export default function VaccinationMode({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <EmptyState icon={Syringe} title="Model with vaccination — coming soon">
      <p>
        This mode is not available yet. It will extend one of the calibrated models (most likely Model 3b) with
        vaccination, for later stages of the pandemic. Meanwhile, explore the fitted models (modes 1 and 2) or the
        transmission scenarios (mode 3).
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={() => onPick('early')}>Estimate early dynamics</Button>
        <Button onClick={() => onPick('scenarios')}>Transmission scenarios</Button>
      </div>
    </EmptyState>
  )
}
